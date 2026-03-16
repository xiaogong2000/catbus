interface ActivityItem {
  time: string;
  caller: string;
  skill: string;
  provider: string;
  latency: number;
}

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <p className="text-[14px] text-text-muted py-8 text-center">
        No recent activity
      </p>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-[14px] font-semibold text-text">Recent Activity</h3>
      </div>
      <div className="divide-y divide-border">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 hover:bg-bg-subtle transition-[background] duration-[--motion-base]"
          >
            <span className="text-[13px] text-text-muted font-mono shrink-0">
              {item.time}
            </span>
            <span className="text-[14px] text-text truncate">
              <span className="text-text-dim">{item.caller}</span>
              {" \u2192 "}
              <span className="font-medium">{item.skill}</span>
              {" \u2192 "}
              <span className="text-text-dim">{item.provider}</span>
            </span>
            <span className="text-[13px] text-warning font-mono ml-auto shrink-0">
              {item.latency}ms
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
