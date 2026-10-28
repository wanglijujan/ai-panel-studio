import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '../db';
import { generateRoster } from '../core/panelist';
import { runDiscussion, isRunning, cancelDiscussion } from '../services/runner';
import { eventsSince, onEvent, buildEnvelope } from '../repo/events';

export const discussionsRouter = Router();

const fail = (code: string, message: string) => ({ ok: false, error: { code, message } });

// 1. 列表
discussionsRouter.get('/', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT d.id, d.topic, d.expert_count, d.status, d.created_at,
              (SELECT COUNT(*) FROM participants p WHERE p.discussion_id = d.id) AS pc
       FROM discussions d ORDER BY d.created_at DESC`
    )
    .all() as any[];

  res.json({
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      topic: r.topic,
      expertCount: r.expert_count,
      status: r.status,
      createdAt: r.created_at,
      participantCount: r.pc,
    })),
  });
});

// 2. 创建
const CreateSchema = z.object({
  topic: z.string().trim().min(10, '议题至少 10 个字').max(200, '议题最多 200 字'),
  expertCount: z.number().int().min(3).max(6),
});

discussionsRouter.post('/', async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail('BAD_REQUEST', parsed.error.issues[0]?.message ?? '参数不合法'));
  }

  const { topic, expertCount } = parsed.data;

  let roster;
  try {
    roster = await generateRoster(topic, expertCount);
  } catch (e) {
    return res.status(502).json(fail('LLM_FAILED', (e as Error).message));
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const created: any[] = [];

  db.transaction(() => {
    db.prepare(
      `INSERT INTO discussions (id, topic, expert_count, status, created_at) VALUES (?, ?, ?, 'idle', ?)`
    ).run(id, topic, expertCount, now);

    for (const p of roster) {
      const pid = randomUUID();
      db.prepare(
        `INSERT INTO participants (id, discussion_id, role, name, title, stance, color, seat_index)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(pid, id, p.role, p.name, p.title, p.stance, p.color, p.seatIndex);

      db.prepare(
        `INSERT INTO agent_states (discussion_id, participant_id, status, focus_memo, updated_at)
         VALUES (?, ?, 'waiting', '', ?)`
      ).run(id, pid, now);

      created.push({ id: pid, ...p });
    }
  })();

  res.status(201).json({
    ok: true,
    data: {
      id,
      topic,
      status: 'idle',
      participants: created.map((p) => ({
        id: p.id,
        role: p.role,
        name: p.name,
        title: p.title,
        stance: p.stance,
        color: p.color,
        seatIndex: p.seatIndex,
      })),
    },
  });
});

// 3. 详情
discussionsRouter.get('/:id', (req, res) => {
  const d = db.prepare(`SELECT * FROM discussions WHERE id = ?`).get(req.params.id) as any;
  if (!d) return res.status(404).json(fail('NOT_FOUND', '讨论不存在'));

  const participants = db
    .prepare(`SELECT * FROM participants WHERE discussion_id = ? ORDER BY seat_index`)
    .all(d.id) as any[];
  const states = db
    .prepare(`SELECT participant_id, status, focus_memo FROM agent_states WHERE discussion_id = ?`)
    .all(d.id) as any[];
  const messages = db
    .prepare(
      `SELECT m.*, p.name, p.title, p.color FROM messages m
       JOIN participants p ON p.id = m.participant_id
       WHERE m.discussion_id = ? ORDER BY m.created_at ASC`
    )
    .all(d.id) as any[];
  const consensus = db
    .prepare(`SELECT id, round, type, content FROM consensus_items WHERE discussion_id = ? ORDER BY created_at ASC`)
    .all(d.id) as any[];

  res.json({
    ok: true,
    data: {
      id: d.id,
      topic: d.topic,
      status: d.status,
      createdAt: d.created_at,
      participants: participants.map((p) => ({
        id: p.id, role: p.role, name: p.name, title: p.title,
        stance: p.stance, color: p.color, seatIndex: p.seat_index,
      })),
      agentStates: states.map((s) => ({
        participantId: s.participant_id, status: s.status, focusMemo: s.focus_memo,
      })),
      messages: messages.map((m) => ({
        id: m.id, round: m.round, participantId: m.participant_id, act: m.act,
        content: m.content, name: m.name, title: m.title, color: m.color,
        createdAt: m.created_at,
      })),
      consensus,
      summary: d.summary_json ? JSON.parse(d.summary_json) : null,
    },
  });
});

// 4. 开始
discussionsRouter.post('/:id/start', (req, res) => {
  const d = db.prepare(`SELECT id, status FROM discussions WHERE id = ?`).get(req.params.id) as any;
  if (!d) return res.status(404).json(fail('NOT_FOUND', '讨论不存在'));
  if (isRunning(d.id) || d.status === 'running') return res.status(409).json(fail('CONFLICT', '讨论已在进行中'));
  if (d.status === 'finished') return res.status(409).json(fail('CONFLICT', '讨论已结束'));

  void runDiscussion(d.id);
  res.status(202).json({ ok: true, data: { status: 'running' } });
});

// 5. 结束
discussionsRouter.post('/:id/end', (req, res) => {
  const d = db.prepare(`SELECT id, status, summary_json FROM discussions WHERE id = ?`).get(req.params.id) as any;
  if (!d) return res.status(404).json(fail('NOT_FOUND', '讨论不存在'));

  if (d.status === 'finished') {
    return res.json({
      ok: true,
      data: { summary: d.summary_json ? JSON.parse(d.summary_json) : null },
    });
  }

  if (isRunning(d.id)) {
    cancelDiscussion(d.id);
    return res.status(202).json({ ok: true, data: { status: 'finishing' } });
  }

  return res.status(409).json(fail('CONFLICT', '讨论尚未开始'));
});

// 6. SSE 事件流
discussionsRouter.get('/:id/stream', (req, res) => {
  const d = db.prepare(`SELECT id FROM discussions WHERE id = ?`).get(req.params.id);
  if (!d) return res.status(404).json(fail('NOT_FOUND', '讨论不存在'));

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const lastId = Number(req.headers['last-event-id'] ?? req.query.lastEventId ?? 0) || 0;

  // 补发历史
  for (const e of eventsSince(String(req.params.id), lastId)) {
    res.write(`id: ${e.seq}\ndata: ${buildEnvelope(e.type, e.payload)}\n\n`);
  }

  // 订阅实时
  const off = onEvent(String(req.params.id), (e) => {
    res.write(`id: ${e.seq}\ndata: ${e.data}\n\n`);
  });

  const ping = setInterval(() => res.write(': ping\n\n'), 15000);

  req.on('close', () => {
    clearInterval(ping);
    off();
    res.end();
  });
});

// 7. 删除（可选）
discussionsRouter.delete('/:id', (req, res) => {
  const info = db.prepare(`DELETE FROM discussions WHERE id = ?`).run(req.params.id);
  if (info.changes === 0) return res.status(404).json(fail('NOT_FOUND', '讨论不存在'));
  res.status(204).end();
});
