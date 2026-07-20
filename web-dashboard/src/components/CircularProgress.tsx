interface Props {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  displayValue?: string;
  tone?: "good" | "warning" | "bad" | "neutral";
}

const TONE_COLOR: Record<string, string> = {
  good: "var(--success)",
  warning: "var(--warning)",
  bad: "var(--danger)",
  neutral: "var(--primary)",
};

export default function CircularProgress({
  value,
  max = 100,
  size = 96,
  strokeWidth = 9,
  label,
  displayValue,
  tone = "neutral",
}: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="circular-kpi">
      <div className="circular-kpi-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={TONE_COLOR[tone]}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="circular-kpi-value">{displayValue ?? `${Math.round(value)}%`}</div>
      </div>
      <div className="circular-kpi-label">{label}</div>
    </div>
  );
}
