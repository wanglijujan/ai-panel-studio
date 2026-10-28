import 'dotenv/config';
import { generateRoster } from './panelist';
import { planRound, type Expert, type HistoryItem } from './scheduler';
import { extractConsensus } from './consensus';

const TOPIC = '远程办公是否会降低团队创新力';

async function main() {
  const roster = await generateRoster(TOPIC, 4);

  const experts: Expert[] = roster
    .filter((p) => p.role === 'expert')
    .map((p, i) => ({
      id: `e${i + 1}`,
      name: p.name,
      title: p.title,
      stance: p.stance,
    }));

  const byId = new Map(experts.map((e) => [e.id, e]));

  console.log('\n【嘉宾阵容】');
  experts.forEach((e) => console.log(`  ${e.id} ${e.name}（${e.title}）— ${e.stance}`));

  const questions = [
    '远程办公是否真的削弱了团队的非正式交流？',
    '如果削弱了，这对创新产出的影响有多大？',
    '有没有可能通过机制设计弥补这部分损失？',
  ];

  const history: HistoryItem[] = [];
  const existing: string[] = [];
  let previousSpeakerIds: string[] = [];

  for (let round = 1; round <= questions.length; round++) {
    const question = questions[round - 1];
    console.log(`\n───────── 第 ${round} 轮 ─────────`);
    console.log(`主持人：${question}`);

    const speeches = await planRound({
      topic: TOPIC,
      round,
      question,
      experts,
      recentMessages: history.slice(-6),
      previousSpeakerIds,
      mustRebutt: round >= 2,
    });

    for (const s of speeches) {
      const e = byId.get(s.participantId)!;
      console.log(`\n  ${e.name}（${e.title}）【${s.act}】`);
      console.log(`  ${s.content}`);
      history.push({
        round,
        speakerName: e.name,
        act: s.act,
        content: s.content,
      });
    }

    previousSpeakerIds = speeches.map((s) => s.participantId);

    try {
      const items = await extractConsensus({
        topic: TOPIC,
        round,
        recentMessages: history
          .filter((h) => h.round === round)
          .map((h) => ({ speakerName: h.speakerName, content: h.content })),
        existing,
      });

      for (const it of items) {
        existing.push(it.content);
        console.log(`\n  →【${it.type === 'consensus' ? '共识' : '分歧'}】${it.content}`);
      }
    } catch (e) {
      console.warn('  [共识提取失败]', (e as Error).message);
    }
  }

  console.log('\n【最终共识/分歧清单】');
  existing.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
}

main().catch((e) => {
  console.error('[scheduler.try] 失败：', e);
  process.exit(1);
});
