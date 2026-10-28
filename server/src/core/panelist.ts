import { z } from 'zod';
import { chatJSON } from '../llm';

const COLORS = [
  '#E11D48',
  '#2563EB',
  '#059669',
  '#D97706',
  '#7C3AED',
  '#0891B2',
  '#DB2777',
];

const Person = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  stance: z.string().min(4).max(40),
});

const RosterSchema = z.object({
  host: Person,
  experts: z.array(Person).min(3).max(8),
});

export type GeneratedPanelist = {
  role: 'host' | 'expert';
  name: string;
  title: string;
  stance: string;
  color: string;
  seatIndex: number;
};

const SYSTEM_PROMPT = `你是圆桌会议策划专家。根据议题设计一套真实的参会阵容。

硬性要求：
1. 1 位主持人，立场中立，负责引导与收束；
2. 每位专家立场必须互不相同且存在真实冲突（有人支持、有人反对、有人提条件），禁止"综合来看都对"；
3. 姓名用中文人名，各不相同；
4. 头衔要具体（如"组织行为学教授""新能源车企产品经理"），不要写"专家""学者"；
5. 立场用一句话，不超过 30 字，必须能直接看出站哪一边；
6. 禁止出现立场雷同的两个人。

只输出 JSON，不要任何解释文字，格式：
{"host":{"name":"","title":"","stance":""},"experts":[{"name":"","title":"","stance":""}]}`;

export async function generateRoster(
  topic: string,
  expertCount: number
): Promise<GeneratedPanelist[]> {
  const raw = await chatJSON<unknown>({
    system: SYSTEM_PROMPT,
    user: `议题：${topic}\n需要 ${expertCount} 位专家。`,
  });

  const parsed = RosterSchema.parse(raw);
  const experts = parsed.experts.slice(0, expertCount);

  if (experts.length < expertCount) {
    throw new Error(
      `模型只生成了 ${experts.length} 位专家，需要 ${expertCount} 位`
    );
  }

  // 姓名去重，避免出现两个"陈默"
  const seen = new Set<string>();
  const dedupe = (n: string) => {
    let name = n.trim();
    let i = 2;
    while (seen.has(name)) name = `${n.trim()}·${i++}`;
    seen.add(name);
    return name;
  };

  return [
    {
      role: 'host',
      ...parsed.host,
      name: dedupe(parsed.host.name),
      color: COLORS[0],
      seatIndex: 0,
    },
    ...experts.map((e, i) => ({
      role: 'expert' as const,
      ...e,
      name: dedupe(e.name),
      color: COLORS[(i + 1) % COLORS.length],
      seatIndex: i + 1,
    })),
  ];
}
