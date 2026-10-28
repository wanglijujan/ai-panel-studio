import { z } from 'zod';
import { chatJSON } from '../llm';

export type ConsensusItem = {
  type: 'consensus' | 'disagreement';
  content: string;
};

const Schema = z.object({
  items: z.array(
    z.object({
      type: z.enum(['consensus', 'disagreement']),
      content: z.string().min(6).max(60),
    })
  ),
});

/** 每轮结束后增量提取，只返回"新出现且不重复"的条目 */
export async function extractConsensus(opts: {
  topic: string;
  round: number;
  recentMessages: { speakerName: string; content: string }[];
  existing: string[];
}): Promise<ConsensusItem[]> {
  const raw = await chatJSON<unknown>({
    system: `你是圆桌讨论的记录员。阅读最近一轮发言，判断是否出现了"新的共识"或"新的分歧"。

规则：
1. 只记录本轮新出现的，且不要与"已有条目"重复或近似；
2. 共识 = 多位专家明确认同的同一判断；分歧 = 双方立场明显对立；
3. 每条不超过 40 字，用陈述句，例如"双方都承认沟通成本是关键变量"；
4. 最多 2 条；如果没有新的，返回 {"items":[]}；
5. 禁止记录"大家还在讨论""需要进一步研究"这类无信息量内容。

只输出 JSON：{"items":[{"type":"consensus|disagreement","content":""}]}`,
    user: JSON.stringify(
      {
        议题: opts.topic,
        当前轮次: opts.round,
        最近发言: opts.recentMessages,
        已有条目: opts.existing,
      },
      null,
      2
    ),
    temperature: 0.3,
  });

  const parsed = Schema.parse(raw);
  const seen = new Set(opts.existing.map((s) => s.trim()));

  return parsed.items
    .filter((i) => !seen.has(i.content.trim()))
    .slice(0, 2);
}
