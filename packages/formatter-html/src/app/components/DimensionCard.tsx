import type { Diagnostic, Dimension } from '../types.ts';

import CircularProgress from './CircularProgress.tsx';
import GradeBadge from './GradeBadge.tsx';
import SignalCard from './SignalCard.tsx';

interface DimensionCardProps {
  dimension: Dimension;
  diagnostics?: Diagnostic[];
}

export default function DimensionCard({ dimension, diagnostics }: DimensionCardProps) {
  const signalCount = dimension.signals?.length || 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start gap-4">
          <CircularProgress score={dimension.score} size={70} strokeWidth={5} labelSize="text-xl" />
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{dimension.name}</h3>
            <p className="text-sm text-gray-600 mb-2">{dimension.intention}</p>
            <div className="flex gap-3">
              <GradeBadge grade={dimension.grade} />
              <span className="px-2 py-0.5 rounded text-sm bg-gray-100 text-gray-700">
                Signals: {signalCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Signals */}
      {dimension.signals && dimension.signals.length > 0 && (
        <div className="p-4 space-y-3 bg-gray-50">
          {dimension.signals.map((signal, index) => (
            <SignalCard key={index} signal={signal} diagnostics={diagnostics} />
          ))}
        </div>
      )}
    </div>
  );
}
