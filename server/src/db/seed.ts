import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { db } from './index';

type Roster = {
  role: 'host' | 'expert';
  name: string;
  title: string;
  stance: string;
  color: string;
};

type Msg = { seat: number; round: number; act: string; content: string };

type Consensus = { round: number; type: 'consensus' | 'disagreement'; content: string };

type Sample = {
  topic: string;
  status: 'idle' | 'running' | 'finished';
  roster: Roster[];
  messages?: Msg[];
  consensus?: Consensus[];
  summary?: object;
};

const samples: Sample[] = [
  {
    topic: '远程办公是否会降低团队创新力',
    status: 'finished',
    roster: [
      { role: 'host', name: '林岚', title: '资深圆桌主持人', stance: '中立引导，负责收束分歧', color: '#E11D48' },
      { role: 'expert', name: '陈默', title: '组织行为学教授', stance: '远程削弱非正式交流，创新必然下降', color: '#2563EB' },
      { role: 'expert', name: '苏青', title: '分布式团队顾问', stance: '异步协作反而提升深度思考质量', color: '#059669' },
      { role: 'expert', name: '何川', title: 'HR 数据负责人', stance: '取决于团队成熟度，不能一概而论', color: '#D97706' },
      { role: 'expert', name: '李澄', title: '连续创业者', stance: '早期团队必须线下，规模化后应远程', color: '#7C3AED' },
    ],
    messages: [
      { seat: 0, round: 1, act: 'opening', content: '欢迎各位。今天讨论远程办公与团队创新力的关系，请各自先给出判断。' },
      { seat: 1, round: 1, act: 'supplement', content: '我的研究显示，创新产出与偶发性的走廊对话高度相关，远程把这类对话压缩了七成。' },
      { seat: 2, round: 1, act: 'rebut', content: '这个结论忽略了质量维度。异步书面沟通迫使表达更完整，深度讨论反而更充分。' },
      { seat: 3, round: 2, act: 'supplement', content: '我调过 40 家公司的数据，差异主要由团队规模解释，而非办公形式本身。' },
    ],
    consensus: [
      { round: 1, type: 'disagreement', content: '创新是否依赖非正式交流，双方存在根本分歧' },
      { round: 2, type: 'consensus', content: '团队规模与协作成熟度是关键中间变量' },
    ],
    summary: {
      conclusions: ['远程办公对创新的影响不是单向的，取决于协作成熟度'],
      disagreements: ['非正式交流是否不可替代'],
      nextSteps: ['区分探索型任务与执行型任务分别制定办公策略'],
    },
  },
  {
    topic: '大学是否应全面采用 AI 辅助教学',
    status: 'idle',
    roster: [
      { role: 'host', name: '周砚', title: '教育专栏主持', stance: '中立，关注落地可行性', color: '#E11D48' },
      { role: 'expert', name: '郑澜', title: '教育技术学教授', stance: 'AI 能实现真正的个性化学习', color: '#2563EB' },
      { role: 'expert', name: '王楚', title: '一线讲师', stance: '学生会丧失独立思考能力', color: '#059669' },
      { role: 'expert', name: '孙禾', title: '高校教务管理者', stance: '评价体系不改，工具再好也没用', color: '#D97706' },
    ],
  },
  {
    topic: '电动汽车的续航焦虑是否被过度放大',
    status: 'running',
    roster: [
      { role: 'host', name: '秦越', title: '科技话题主持', stance: '中立', color: '#E11D48' },
      { role: 'expert', name: '方哲', title: '电池工程师', stance: '焦虑主要来自补能网络而非续航数字', color: '#2563EB' },
      { role: 'expert', name: '柳萱', title: '消费者研究员', stance: '心理账户效应被严重低估', color: '#0891B2' },
      { role: 'expert', name: '吴岸', title: '长途货车司机', stance: '真实使用场景下焦虑完全合理', color: '#D97706' },
    ],
  },
  {
    topic: '年轻人应该先买房还是先投资自己',
    status: 'finished',
    roster: [
      { role: 'host', name: '许知', title: '财经圆桌主持', stance: '中立，引导回到数据', color: '#E11D48' },
      { role: 'expert', name: '陈屿', title: '宏观经济学家', stance: '资产价格周期决定一切', color: '#2563EB' },
      { role: 'expert', name: '苏禾', title: '职业规划顾问', stance: '人力资本回报率远高于房产', color: '#059669' },
      { role: 'expert', name: '李默', title: '一线城市购房者', stance: '安全感是无法量化的成本', color: '#7C3AED' },
    ],
    messages: [
      { seat: 0, round: 1, act: 'opening', content: '这个话题很容易变成情绪对撞，我们先约定用数据说话。' },
      { seat: 1, round: 1, act: 'supplement', content: '过去二十年房产的年化回报在多数城市跑赢了工资增速，这是事实基础。' },
      { seat: 2, round: 1, act: 'rebut', content: '那是后视镜。同期人力资本的回报方差更大，头部收益远高于房产中位数。' },
      { seat: 3, round: 2, act: 'supplement', content: '你们都在算收益率，但没人算过没有房子时被迫短租、频繁搬家的隐性成本。' },
    ],
    consensus: [
      { round: 1, type: 'disagreement', content: '过去数据能否外推到未来' },
      { round: 2, type: 'consensus', content: '决策应取决于所在城市的租售比与个人现金流稳定性' },
    ],
    summary: {
      conclusions: ['不存在普适答案，关键变量是城市租售比与职业阶段'],
      disagreements: ['房产的安全感是否应计入收益'],
      nextSteps: ['先计算自身租售比，再评估技能投资回报周期'],
    },
  },
  {
    topic: '开源软件的商业化是否必然损害社区',
    status: 'idle',
    roster: [
      { role: 'host', name: '陆时', title: '开源社区观察者', stance: '中立', color: '#E11D48' },
      { role: 'expert', name: '张束', title: '开源项目 Maintainer', stance: '商业化是可持续的唯一出路', color: '#2563EB' },
      { role: 'expert', name: '何夕', title: '基金会法务顾问', stance: '许可证设计决定成败', color: '#059669' },
      { role: 'expert', name: '楚南', title: '企业技术采购', stance: '企业只想要免费劳动力', color: '#7C3AED' },
      { role: 'expert', name: '江白', title: '独立开发者', stance: '社区信任一旦破坏无法修复', color: '#DB2777' },
    ],
  },
];

const insertOne = db.transaction((s: Sample) => {
  const discussionId = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO discussions (id, topic, expert_count, status, summary_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    discussionId,
    s.topic,
    s.roster.filter((r) => r.role === 'expert').length,
    s.status,
    s.summary ? JSON.stringify(s.summary) : null,
    now
  );

  const ids: string[] = [];
  s.roster.forEach((p, i) => {
    const pid = randomUUID();
    ids.push(pid);
    db.prepare(
      `INSERT INTO participants (id, discussion_id, role, name, title, stance, color, seat_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(pid, discussionId, p.role, p.name, p.title, p.stance, p.color, i);

    db.prepare(
      `INSERT INTO agent_states (discussion_id, participant_id, status, focus_memo, updated_at)
       VALUES (?, ?, 'waiting', '', ?)`
    ).run(discussionId, pid, now);
  });

  for (const m of s.messages ?? []) {
    db.prepare(
      `INSERT INTO messages (id, discussion_id, round, participant_id, act, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), discussionId, m.round, ids[m.seat], m.act, m.content, now);
  }

  for (const c of s.consensus ?? []) {
    db.prepare(
      `INSERT INTO consensus_items (id, discussion_id, round, type, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), discussionId, c.round, c.type, c.content, now);
  }

  return discussionId;
});

const existing = db.prepare('SELECT COUNT(*) AS n FROM discussions').get() as { n: number };

if (existing.n > 0) {
  console.log(`[seed] 数据库中已有 ${existing.n} 条讨论，跳过。若要重置请先删除 server/data/panel.db`);
} else {
  for (const s of samples) insertOne(s);
  console.log(`[seed] 已写入 ${samples.length} 条样例讨论`);
}

const stats = db
  .prepare(
    `SELECT
       (SELECT COUNT(*) FROM discussions)    AS discussions,
       (SELECT COUNT(*) FROM participants)   AS participants,
       (SELECT COUNT(*) FROM messages)       AS messages,
       (SELECT COUNT(*) FROM consensus_items) AS consensus`
  )
  .get();

console.table(stats);
