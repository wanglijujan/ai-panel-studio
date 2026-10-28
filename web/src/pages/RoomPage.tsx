import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useDiscussionStream } from '../hooks/useDiscussionStream';
import type {
  AgentState,
  ConsensusItem,
  DiscussionDetail,
  Message,
  Summary,
} from '../types';
import ParticipantCard from '../components/ParticipantCard';
import TranscriptItem from '../components/TranscriptItem';
import ConsensusPanel from '../components/ConsensusPanel';

function SummaryCard({ summary }: { summary: Summary }) {
  const block = (title: string, list: string[], color: string) => (
    <div>
      <div className={`mb-1 text-xs font-medium ${color}`}>{title}</div>
      <ul className="space-y-1">
        {list.map((s, i) => (
          <li key={i} className="text-xs leading-relaxed text-slate-700">
            · {s}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
      <div className="mb-3 text-sm font-medium text-violet-800">讨论总结</div>
      <div className="space-y-3">
        {block('核心结论', summary.conclusions, 'text-emerald-700')}
        {block('主要分歧', summary.disagreements, 'text-amber-700')}
        {block('下一步建议', summary.nextSteps, 'text-blue-700')}
      </div>
    </div>
  );
}

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<DiscussionDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [consensus, setConsensus] = useState<ConsensusItem[]>([]);
  const [states, setStates] = useState<Record<string, AgentState>>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [round, setRound] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;

    api
      .detail(id)
      .then((d) => {
        setDetail(d);
        setStatus(d.status);
        setSummary(d.summary);
        setMessages(d.messages);
        setConsensus(d.consensus);

        const map: Record<string, AgentState> = {};
        d.agentStates.forEach((s) => {
          map[s.participantId] = s;
        });
        setStates(map);

        if (d.messages.length > 0) {
          setRound(d.messages[d.messages.length - 1].round);
        }
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  const handleEvent = useCallback((e: any) => {
    switch (e.type) {
      case 'round_start':
        setRound(e.round);
        break;

      case 'speech': {
        const m = e.message as Message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        break;
      }

      case 'agent_status':
        setStates((prev) => ({
          ...prev,
          [e.participantId]: {
            participantId: e.participantId,
            status: e.status,
            focusMemo: e.focusMemo,
          },
        }));
        break;

      case 'consensus_update': {
        const items = e.items as { type: 'consensus' | 'disagreement'; content: string }[];
        setConsensus((prev) => {
          const seen = new Set(prev.map((p) => p.content));
          const add = items
            .filter((i) => !seen.has(i.content))
            .map((i, idx) => ({
              id: `${Date.now()}-${idx}`,
              round: 0,
              type: i.type,
              content: i.content,
            }));
          return [...prev, ...add];
        });
        break;
      }

      case 'summary':
        setSummary(e.summary as Summary);
        break;

      case 'done':
        setStatus('finished');
        break;

      case 'error':
        console.warn('[stream] 服务端错误', e);
        break;
    }
  }, []);

  useDiscussionStream(id, handleEvent);

  const onStart = async () => {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      await api.start(id);
      setStatus('running');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!detail) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        {error || '加载中…'}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex flex-wrap items-center gap-3 border-b bg-white px-5 py-3">
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">
          ← 返回
        </Link>
        <h1 className="text-sm font-medium text-slate-800">{detail.topic}</h1>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
          {status === 'running' ? '进行中' : status === 'finished' ? '已结束' : '未开始'}
        </span>

        {status === 'idle' && (
          <button
            onClick={onStart}
            disabled={busy}
            className="ml-auto rounded-lg bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {busy ? '启动中…' : '开始讨论'}
          </button>
        )}

        {status === 'running' && (
          <span className="ml-auto text-xs text-emerald-600">● 直播中 · 第 {round} 轮</span>
        )}

        {error && <span className="text-xs text-red-600">{error}</span>}
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[280px_1fr_320px]">
        <aside className="min-h-0 space-y-3 overflow-y-auto">
          {detail.participants.map((p) => (
            <ParticipantCard key={p.id} participant={p} state={states[p.id]} />
          ))}
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-white">
          <div className="border-b px-4 py-2 text-xs font-medium text-slate-500">现场记录</div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            {messages.map((m) => (
              <TranscriptItem key={m.id} message={m} />
            ))}
            {messages.length === 0 && (
              <p className="text-sm text-slate-400">
                点击「开始讨论」后，对话会在这里实时出现。
              </p>
            )}
            {summary && <SummaryCard summary={summary} />}
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto rounded-2xl border bg-white p-3">
          <ConsensusPanel items={consensus} />
        </aside>
      </main>
    </div>
  );
}
