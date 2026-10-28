import type { ConsensusItem } from '../types';

export default function ConsensusPanel({ items }: { items: ConsensusItem[] }) {
  const consensus = items.filter((i) => i.type === 'consensus');
  const disagreements = items.filter((i) => i.type === 'disagreement');

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-xs font-medium tracking-wide text-slate-500">实时共识</h3>
        <ul className="space-y-2">
          {consensus.length === 0 && <li className="text-xs text-slate-400">暂无</li>}
          {consensus.map((i) => (
            <li
              key={i.id}
              className="rounded-lg bg-emerald-50 p-2 text-xs leading-relaxed text-emerald-900"
            >
              {i.content}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium tracking-wide text-slate-500">观点分歧</h3>
        <ul className="space-y-2">
          {disagreements.length === 0 && <li className="text-xs text-slate-400">暂无</li>}
          {disagreements.map((i) => (
            <li
              key={i.id}
              className="rounded-lg bg-amber-50 p-2 text-xs leading-relaxed text-amber-900"
            >
              {i.content}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
