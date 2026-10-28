import type { AgentState, Participant } from '../types';

const STATUS_TEXT: Record<string, string> = {
  waiting: '等待',
  preparing: '准备中',
  speaking: '发言中',
};

const STATUS_CLASS: Record<string, string> = {
  waiting: 'bg-slate-100 text-slate-500',
  preparing: 'bg-amber-100 text-amber-700',
  speaking: 'bg-emerald-100 text-emerald-700',
};

export default function ParticipantCard({
  participant,
  state,
}: {
  participant: Participant;
  state?: AgentState;
}) {
  return (
    <div
      className="rounded-xl border bg-white p-3"
      style={{ borderLeft: `4px solid ${participant.color}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: participant.color }}>
          {participant.name}
          {participant.role === 'host' && (
            <span className="ml-1 text-[10px] font-normal text-slate-400">主持人</span>
          )}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
            STATUS_CLASS[state?.status ?? 'waiting']
          }`}
        >
          {STATUS_TEXT[state?.status ?? 'waiting']}
        </span>
      </div>

      <div className="mt-0.5 text-[11px] text-slate-500">{participant.title}</div>
      <div className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
        {participant.stance}
      </div>

      {state?.focusMemo && (
        <div className="mt-1.5 rounded bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
          {state.focusMemo}
        </div>
      )}
    </div>
  );
}
