const getScoreColor = (score: number): string => {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 50) return '#eab308'; // yellow
  if (score >= 30) return '#f97316'; // orange
  return '#ef4444'; // red
};

interface CircularProgressProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  labelSize?: string;
}

export default function CircularProgress({
  score,
  size = 80,
  strokeWidth = 6,
  showLabel = true,
  labelSize = 'text-2xl',
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      {showLabel && (
        <span className={`absolute font-bold ${labelSize}`} style={{ color }}>
          {Math.round(score)}
        </span>
      )}
    </div>
  );
}
