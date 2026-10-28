import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { DiscussionListItem } from '../types';

const STATUS_TEXT: Record<string, string> = {
  idle: '未开始',
  running: '进行中',
  finished: '已结束',
};

const STATUS_CLASS: Record<string, string> = {
  idle: 'bg-slate-100 text-slate-600',
  running: 'bg-emerald-100 text-emerald-700',
  finished: 'bg-slate-200 text-slate-500',
};

export default function HomePage() {
  const [items, setItems] = useState<DiscussionListItem[]>([]);
  const [topic, setTopic] = useState('');
  const [expertCount, setExpertCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = async () => {
    try {
      setItems(await api.list());
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async () => {
    if (topic.trim().length < 10) {
      setError('议题至少 10 个字');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const d = await api.create(topic.trim(), expertCount);
      navigate(`/r/${d.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-slate-900">AI Panel Studio</h1>
        <p className="text-sm text-slate-500">输入议题，召集一场 AI 圆桌讨论</p>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 p-6">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-medium text-slate-800">新建讨论</h2>
          <textarea
            rows={3}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例如：远程办公是否会降低团队创新力"
            className="w-full rounded-lg border p-3 text-sm outline-none focus:border-slate-400"
          />
          <div className="mt-3 flex items-center gap-3">
            <label className="text-sm text-slate-600">专家人数</label>
            <select
              value={expertCount}
              onChange={(e) => setExpertCount(Number(e.target.value))}
              className="rounded-lg border px-3 py-1.5 text-sm"
            >
              {[3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} 位
                </option>
              ))}
            </select>
            <button
              onClick={onCreate}
              disabled={loading}
              className="ml-auto rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loading ? '生成阵容中…' : '生成嘉宾阵容'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-slate-800">讨论列表</h2>
          <div className="space-y-3">
            {items.length === 0 && (
              <p className="text-sm text-slate-400">还没有讨论，先新建一个。</p>
            )}
            {items.map((it) => (
              <Link
                key={it.id}
                to={`/r/${it.id}`}
                className="block rounded-xl border bg-white p-4 transition hover:border-slate-400"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-slate-800">{it.topic}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[it.status]}`}>
                    {STATUS_TEXT[it.status]}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {it.participantCount} 人参与 · {new Date(it.createdAt).toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
