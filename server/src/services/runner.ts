import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '../db';
import { chatJSON } from '../llm';
import { planRound, type Expert } from '../core/scheduler';
import { extractConsensus } from '../core/consensus';
import { emitEvent } from '../repo/events';

const MAX_ROUNDS = 8;

type DbParticipant = {
  id: string;
  role: 'host' | 'expert';
  name: string;
  title: string;
  stance: string;
  color: string;
  seat_index: number;
};

const running = new Set<string>();
const cancelled = new Set<string>();

export const isRunning = (id: string) => running.has(id);
export const cancelDiscussion = (id: string) => cancelled.add(id);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadParticipants(discussionId: string): DbParticipant[] {
  return db
    .prepare(
      `SELECT * FROM participants WHERE discussion_id = ? ORDER BY seat_index ASC`
    )
    .all(discussionId) as DbParticipant[];
}

function setAgentState(
  discussionId: string,
  participantId: string,
  status: 'waiting' | 'preparing' | 'speaking',
  focusMemo = ''
) {
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO agent_states (discussion_id, participant_id, status, focus_memo, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(discussion_id, participant_id)
     DO UPDATE SET status = excluded.status,
                   focus_memo = excluded.focus_memo,
                   updated_at = excluded.updated_at`
  ).run(discussionId, participantId, status, focusMemo, now);

  emitEvent(discussionId, 'agent_status', { participantId, status, focusMemo });
}

function saveMessage(
  discussionId: string,
  round: number,
  participantId: string,
  act: string,
  content: string
) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO messages (id, discussion_id, round, participant_id, act, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, discussionId, round, participantId, act, content, createdAt);

  return { id, round, participantId, act, content, createdAt };
}

function pushSpeech(
  discussionId: string,
  m: ReturnType<typeof saveMessage>,
  p: DbParticipant
) {
  emitEvent(discussionId, 'speech', {
    message: {
      id: m.id,
      round: m.round,
      participantId: p.id,
      name: p.name,
      title: p.title,
      color: p.color,
      act: m.act,
      content: m.content,
      createdAt: m.createdAt,
    },
  });
}

function loadHistory(discussionId: string) {
  const rows = db
    .prepare(
      `SELECT m.round, m.act, m.content, p.name AS speakerName
       FROM messages m
       JOIN participants p ON p.id = m.participant_id
       WHERE m.discussion_id = ?
       ORDER BY m.created_at DESC
       LIMIT 8`
    )
    .all(discussionId) as {
    round: number;
    act: string;
    content: string;
    speakerName: string;
  }[];

  return rows.reverse();
}

// ---------- 主持人问题 ----------

const QuestionsSchema = z.object({
  questions: z.array(z.string().min(6)).min(3).max(8),
});

async function planQuestions(topic: string, experts: Expert[]): Promise<string[]> {
  const raw = await chatJSON<unknown>({
    system: `你是圆桌主持人。为给定议题设计 4~6 个层层递进的提问。

要求：
1. 第一个问题聚焦事实与现状，中间问题制造观点冲突，最后一个问题收束到可行方案；
2. 每个问题一句话，20~40 字，口语化，像真人开口问的；
3. 问题之间要有承接，不要平行罗列；
4. 禁止"请问您如何看待"这类套话。

只输出 JSON：{"questions":["",""]}`,
    user: JSON.stringify(
      {
        议题: topic,
        嘉宾: experts.map((e) => ({ 姓名: e.name, 头衔: e.title, 立场: e.stance })),
      },
      null,
      2
    ),
    temperature: 0.8,
  });

  return QuestionsSchema.parse(raw).questions.slice(0, 6);
}

// ---------- 总结 ----------

const SummarySchema = z.object({
  conclusions: z.array(z.string()),
  disagreements: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

async function generateSummary(topic: string, discussionId: string) {
  const rows = db
    .prepare(
      `SELECT p.name, m.content FROM messages m
       JOIN participants p ON p.id = m.participant_id
       WHERE m.discussion_id = ? ORDER BY m.created_at ASC`
    )
    .all(discussionId) as { name: string; content: string }[];

  const transcript = rows.map((r) => `${r.name}：${r.content}`).join('\n');

  const raw = await chatJSON<unknown>({
    system: `你是圆桌主持人。根据完整讨论记录输出结构化总结。

要求：
1. conclusions（核心结论）2~3 条，每条一句话；
2. disagreements（主要分歧）1~3 条，必须真实存在于讨论中，不能虚构；
3. nextSteps（下一步建议）1~3 条，可执行；
4. 每条不超过 40 字。

只输出 JSON：{"conclusions":[],"disagreements":[],"nextSteps":[]}`,
    user: `议题：${topic}\n\n讨论记录：\n${transcript}`,
    temperature: 0.4,
  });

  return SummarySchema.parse(raw);
}

// ---------- 主循环 ----------

export async function runDiscussion(discussionId: string): Promise<void> {
  if (running.has(discussionId)) return;
  running.add(discussionId);
  cancelled.delete(discussionId);

  try {
    const d = db
      .prepare(`SELECT id, topic FROM discussions WHERE id = ?`)
      .get(discussionId) as { id: string; topic: string } | undefined;
    if (!d) throw new Error('讨论不存在');

    const participants = loadParticipants(discussionId);
    const host = participants.find((p) => p.role === 'host');
    if (!host) throw new Error('缺少主持人');

    const experts: Expert[] = participants
      .filter((p) => p.role === 'expert')
      .map((p) => ({ id: p.id, name: p.name, title: p.title, stance: p.stance }));

    const byId = new Map(participants.map((p) => [p.id, p]));

    db.prepare(`UPDATE discussions SET status = 'running' WHERE id = ?`).run(discussionId);

    // 1. 开场
    const opening = `欢迎各位。今天的议题是「${d.topic}」，我们有 ${experts.length} 位专家在场。请先各自亮明立场。`;
    pushSpeech(discussionId, saveMessage(discussionId, 0, host.id, 'opening', opening), host);
    await sleep(400);

    // 2. 生成问题序列
    let questions: string[];
    try {
      questions = await planQuestions(d.topic, experts);
    } catch (e) {
      console.warn('[runner] 问题生成失败，使用兜底问题', (e as Error).message);
      questions = [`关于「${d.topic}」，各位的核心判断分别是什么？`];
    }

    const totalRounds = Math.min(questions.length, MAX_ROUNDS);
    let previousSpeakerIds: string[] = [];
    let roundsSinceRebutt = 99;

    // 3. 逐轮推进
    for (let round = 1; round <= totalRounds; round++) {
      if (cancelled.has(discussionId)) break;

      const question = questions[round - 1];
      emitEvent(discussionId, 'round_start', { round, question });
      pushSpeech(discussionId, saveMessage(discussionId, round, host.id, 'question', question), host);
      await sleep(300);

      let speeches;
      try {
        speeches = await planRound({
          topic: d.topic,
          round,
          question,
          experts,
          recentMessages: loadHistory(discussionId),
          previousSpeakerIds,
          mustRebutt: roundsSinceRebutt >= 2,
        });
      } catch (e) {
        console.warn('[runner] 调度失败，跳过本轮', (e as Error).message);
        emitEvent(discussionId, 'error', { round, message: '本轮调度失败，已跳过' });
        continue;
      }

      for (const s of speeches) {
        const p = byId.get(s.participantId);
        if (!p) continue;

        setAgentState(discussionId, p.id, 'preparing', `正在组织回应：${s.content.slice(0, 16)}…`);
        await sleep(250);
        setAgentState(discussionId, p.id, 'speaking');
        await sleep(300);

        pushSpeech(discussionId, saveMessage(discussionId, round, p.id, s.act, s.content), p);

        setAgentState(discussionId, p.id, 'waiting');
        await sleep(300);
      }

      previousSpeakerIds = speeches.map((s) => s.participantId);
      roundsSinceRebutt = speeches.some((s) => s.act === 'rebut') ? 0 : roundsSinceRebutt + 1;

      // 4. 增量提取共识
      try {
        const existingRows = db
          .prepare(`SELECT content FROM consensus_items WHERE discussion_id = ?`)
          .all(discussionId) as { content: string }[];

        const items = await extractConsensus({
          topic: d.topic,
          round,
          recentMessages: speeches.map((s) => ({
            speakerName: byId.get(s.participantId)?.name ?? '',
            content: s.content,
          })),
          existing: existingRows.map((r) => r.content),
        });

        for (const it of items) {
          db.prepare(
            `INSERT INTO consensus_items (id, discussion_id, round, type, content, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).run(randomUUID(), discussionId, round, it.type, it.content, new Date().toISOString());
        }

        if (items.length > 0) {
          emitEvent(discussionId, 'consensus_update', { items });
        }
      } catch (e) {
        console.warn('[runner] 共识提取失败', (e as Error).message);
      }
    }

    // 5. 收尾
    const summary = await generateSummary(d.topic, discussionId);

    const closing = `今天讨论到这里。${summary.conclusions[0] ?? '各方仍存在分歧'}。感谢各位。`;
    pushSpeech(
      discussionId,
      saveMessage(discussionId, totalRounds + 1, host.id, 'summary', closing),
      host
    );

    db.prepare(
      `UPDATE discussions SET status = 'finished', summary_json = ? WHERE id = ?`
    ).run(JSON.stringify(summary), discussionId);

    emitEvent(discussionId, 'summary', { summary });
    emitEvent(discussionId, 'done', { status: 'finished' });
  } catch (err) {
    console.error('[runner] 讨论中断：', err);
    try {
      emitEvent(discussionId, 'error', { message: (err as Error).message });
      db.prepare(`UPDATE discussions SET status = 'finished' WHERE id = ?`).run(discussionId);
      emitEvent(discussionId, 'done', { status: 'finished' });
    } catch {
      /* 忽略二次失败 */
    }
  } finally {
    running.delete(discussionId);
    cancelled.delete(discussionId);
  }
}
