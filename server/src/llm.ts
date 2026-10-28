import 'dotenv/config';

const API_KEY = process.env.DEEPSEEK_API_KEY;
const BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
const MODEL = 'deepseek-chat';

if (!API_KEY) throw new Error('[llm] 缺少 DEEPSEEK_API_KEY，请检查 server/.env');

type Options = {
  system: string;
  user: string;
  temperature?: number;
  maxRetries?: number;
};

/**
 * 调用模型并强制返回 JSON。
 * 失败自动重试，全部失败才抛错，业务层不需要自己写重试逻辑。
 */
export async function chatJSON<T>({
  system,
  user,
  temperature = 0.85,
  maxRetries = 2,
}: Options): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('模型返回内容为空');

      return JSON.parse(content) as T;
    } catch (err) {
      lastError = err;
      console.warn(`[llm] 第 ${attempt + 1} 次失败：${(err as Error).message}`);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
