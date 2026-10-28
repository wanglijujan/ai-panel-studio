import type { Message } from '../types';

const ACT_LABEL: Record<string, string> = {
  rebut: '反驳',
  question: '提问',
  opening: '开场',
  summary: '收尾',
};

const ACT_CLASS: Record<string, string> = {
  rebut: 'bg-rose-50 text-rose-600',
  question: 'bg-slate-100 text-slate-500',
  opening: 'bg-blue-50 text-blue-600',
  summary: 'bg-violet-50 text-violet-600',
};

export default function TranscriptItem({ message }: { message: Message }) {
  return (
    <div className="flex gap-3">
      <div
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ background: message.color }}
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium" style={{ color: message.color }}>
            {message.name}
          </span>
          <span className="text-[11px] text-slate-400">{message.title}</span>
          {ACT_LABEL[message.act] && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${ACT_CLASS[message.act]}`}>
              {ACT_LABEL[message.act]}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{message.content}</p>
      </div>
    </div>
  );
}
