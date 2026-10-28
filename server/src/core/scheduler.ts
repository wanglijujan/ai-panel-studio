import { z } from 'zod';
import { chatJSON } from '../llm';

export type Expert = {
  id: string;
  name: string;
  title: string;
  stance: string;
};

export type Act = 'rebut' | 'supplement' | 'agree' | 'question';

export type Speech = {
  participantId: string;
  act: Act;
  targetId?: string | null;
  content: string;
};

export type HistoryItem = {
  round: number;
  speakerName: string;
  act: string;
  content: string;
};

export type PlanContext = {
  topic: string;
  round: number;
  question: string;
  experts: Expert[];
  recentMessages: HistoryItem[];
  previousSpeakerIds: string[];
  mustRebutt: boolean;
};

const SpeechSchema = z.object({
  participantId: z.string(),
  act: z.enum(['rebut', 'supplement', 'agree', 'question']),
  targetId: z.string().nullable().optional(),
  content: z.string(),
});

const PlanSchema = z.object({
  speakers: z.array(SpeechSchema),
});

/** 硬性校验：不通过就重试，这是"防幻觉"的核心 */
export function validatePlan(plan: Speech[], ctx: PlanContext): string[] {
  const errors: string[] = [];
  const validIds = new Set(ctx.experts.map((e) => e.id));

  if (plan.length < 1 || plan.length > 2) {
    errors.push(`发言人数必须为 1~2 人，当前 ${plan.length} 人`);
  }

  const seen = new Set<string>();
  for (const s of plan) {
    if (!validIds.has(s.participantId)) {
      errors.push(`participantId 不在候选名单中：${s.participantId}`);
    }
    if (seen.has(s.participantId)) {
      errors.push(`同一轮重复发言：${s.participantId}`);
    }
    seen.add(s.participantId);
    if (s.content.trim().length < 20) {
      errors.push(`发言内容过短（<20 字）：${s.participantId}`);
    }
  }

  if (
    plan.length > 0 &&
    plan.every((s) => ctx.previousSpeakerIds.includes(s.participantId))
  ) {
    errors.push('本轮发言者与上一轮完全相同，需要换人');
  }

  if (ctx.mustRebutt && !plan.some((s) => s.act === 'rebut')) {
    errors.push('本轮要求至少出现一次反驳（act="rebut"），但没有任何人以 rebut 发言');
  }

  return errors;
}

const SYSTEM_PROMPT = `你是一场圆桌讨论的调度器。你的任务不是自己发言，而是决定"这一轮由谁说话、说什么"。

硬性规则：
1. 每轮只允许 1~2 位专家发言，绝不能更多；
2. 发言者必须从"候选专家"的 id 中选择，主持人不在候选内；
3. 不要连续两轮让同一位专家发言；
4. 如果"是否必须出现反驳"为 true，本轮必须至少有一个人 act="rebut"，并指名道姓反驳某位专家的具体观点；
5. 发言内容要求：
   - 紧扣本轮问题，不要跑题；
   - 明确回应前面某位专家的观点（可以同意，也可以反对）；
   - 体现自己独有立场，不要变成中立总结；
   - 60~150 字，口语化，像真人开会说话；
   - 禁止"首先/其次/最后"这类念稿式排比，禁止空话；
6. 不同专家的表达风格要有差异：有人短促犀利、有人引用数据、有人举行业案例。

只输出 JSON，不要解释：
{"speakers":[{"participantId":"","act":"rebut|supplement|agree|question","targetId":"","content":""}]}`;

export async function planRound(ctx: PlanContext): Promise<Speech[]> {
  const payload = {
    议题: ctx.topic,
    当前轮次: ctx.round,
    本轮问题: ctx.question,
    候选专家: ctx.experts.map((e) => ({
      id: e.id,
      姓名: e.name,
      头衔: e.title,
      立场: e.stance,
    })),
    最近发言: ctx.recentMessages,
    上一轮发言者id: ctx.previousSpeakerIds,
    是否必须出现反驳: ctx.mustRebutt,
  };

  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const user =
        JSON.stringify(payload, null, 2) +
        (lastErrors.length
          ? `\n\n上一次输出违反了规则：${lastErrors.join('；')}。请修正后重新输出。`
          : '');

      const raw = await chatJSON<unknown>({
        system: SYSTEM_PROMPT,
        user,
        temperature: 0.95,
      });

      const parsed = PlanSchema.parse(raw);
      const errors = validatePlan(parsed.speakers, ctx);

      if (errors.length === 0) return parsed.speakers;

      lastErrors = errors;
      console.warn(`[scheduler] 第 ${attempt} 次输出不合规：`, errors);
    } catch (err) {
      lastErrors = [(err as Error).message];
      console.warn(`[scheduler] 第 ${attempt} 次调用失败：`, (err as Error).message);
    }
  }

  console.warn('[scheduler] 两次尝试均失败，使用兜底发言');
  return fallback(ctx);
}

/** 兜底：保证流程永不中断，宁可发言平淡也不能卡死 */
function fallback(ctx: PlanContext): Speech[] {
  const pool = ctx.experts.filter((e) => !ctx.previousSpeakerIds.includes(e.id));
  const pick = (pool.length > 0 ? pool : ctx.experts)[0];

  return [
    {
      participantId: pick.id,
      act: 'supplement',
      content: `${pick.stance}。这一点我仍然坚持，具体还要看实际场景里的执行细节。`,
    },
  ];
}
