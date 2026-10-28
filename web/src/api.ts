import type { DiscussionDetail, DiscussionListItem, Summary } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? '请求失败');
  return json.data as T;
}

export const api = {
  list: () => request<DiscussionListItem[]>('/discussions'),
  create: (topic: string, expertCount: number) =>
    request<{ id: string }>('/discussions', {
      method: 'POST',
      body: JSON.stringify({ topic, expertCount }),
    }),
  detail: (id: string) => request<DiscussionDetail>(`/discussions/${id}`),
  start: (id: string) =>
    request<{ status: string }>(`/discussions/${id}/start`, { method: 'POST' }),
  end: (id: string) =>
    request<{ summary: Summary | null }>(`/discussions/${id}/end`, { method: 'POST' }),
};
