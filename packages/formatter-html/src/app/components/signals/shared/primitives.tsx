import type { ReactNode } from 'react';

import {
  getMetricColorClasses,
  getProgressBarColorClass,
  getPercentageStrokeColorClass,
  getPercentageTextColorClass,
  getBadgeColorClasses,
  type MetricColor,
} from './colors.ts';

export interface MetricRowProps {
  label: string;
  value: string | number;
  valueColor?: MetricColor;
  showColon?: boolean;
}

export function MetricRow({ label, value, valueColor, showColon = false }: MetricRowProps) {
  const colorClass = valueColor
    ? getMetricColorClasses(valueColor)
    : 'text-[var(--sc-text-primary,#111827)]';
  return (
    <div className="bg-[var(--sc-section,#f3f4f6)] flex items-center justify-between rounded px-2 py-1.5 text-xs">
      <span className="text-[var(--sc-text-muted,#9ca3af)]">
        {label}
        {showColon ? ':' : ''}
      </span>
      <span className={`font-mono font-medium ${colorClass}`}>{value}</span>
    </div>
  );
}

interface MetricGridProps {
  metrics: MetricRowProps[];
  columns?: 2 | 3;
}

export function MetricGrid({ metrics, columns = 2 }: MetricGridProps) {
  const gridClass = columns === 3 ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <div className={`grid ${gridClass} gap-1`}>
      {metrics.map((metric) => {
        const colorClass = metric.valueColor
          ? getMetricColorClasses(metric.valueColor)
          : 'text-[var(--sc-text-primary,#111827)]';
        return (
          <div
            key={metric.label}
            className="bg-[var(--sc-section,#f3f4f6)] flex items-center justify-between rounded px-2 py-1 text-xs"
          >
            <span className="text-[var(--sc-text-muted,#9ca3af)] mr-2 truncate">
              {metric.label}
              {metric.showColon ? ':' : ''}
            </span>
            <span className={`flex-shrink-0 font-mono font-medium ${colorClass}`}>
              {metric.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="text-[var(--sc-text-muted,#9ca3af)] text-[10px] font-medium uppercase tracking-wide">
      {children}
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  height?: 'sm' | 'md';
}

export function ProgressBar({ value, max = 1, className = '', height = 'md' }: ProgressBarProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const barColor = getProgressBarColorClass(percentage);
  const heightClass = height === 'sm' ? 'h-1.5' : 'h-2';
  return (
    <div
      className={`${heightClass} w-full overflow-hidden rounded-full bg-[var(--sc-section,#f3f4f6)] ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

interface DonutChartProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function DonutChart({
  percentage,
  size = 96,
  strokeWidth = 10,
  className = '',
}: DonutChartProps) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-[var(--cp-track,#e5e7eb)]"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          className={getPercentageStrokeColorClass(percentage)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold ${getPercentageTextColorClass(percentage)}`}>
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

interface SecondaryMetricProps {
  value: number;
  label: string;
  isBad?: boolean;
}

export function SecondaryMetric({ value, label, isBad }: SecondaryMetricProps) {
  if (value === 0 && isBad) return null;
  const colors =
    isBad && value > 0
      ? getBadgeColorClasses('red')
      : { bg: 'bg-[var(--sc-section,#f3f4f6)]', text: 'text-[var(--sc-text-muted,#9ca3af)]' };
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs ${colors.bg} ${colors.text}`}
    >
      <span className="font-mono font-medium">{value}</span>
      <span className="text-[10px] opacity-80">{label}</span>
    </div>
  );
}
