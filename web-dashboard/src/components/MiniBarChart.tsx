interface BarItem {
  label: string;
  value: number;
}

export default function MiniBarChart({ items }: { items: BarItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="mini-bar-chart">
      {items.map((item) => (
        <div className="mini-bar-row" key={item.label}>
          <div className="mini-bar-label">{item.label}</div>
          <div className="mini-bar-track">
            <div className="mini-bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <div className="mini-bar-value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
