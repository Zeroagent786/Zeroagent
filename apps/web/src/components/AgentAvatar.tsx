const PALETTE = [
  ["#1E293B", "#334155"],
  ["#0D9488", "#115E59"],
  ["#78716C", "#44403C"],
  ["#475569", "#1E293B"],
  ["#0F766E", "#134E4A"],
  ["#57534E", "#292524"],
];

export function AgentAvatar({ id, name, size = 44 }: { id: number; name: string; size?: number }) {
  const [a, b] = PALETTE[id % PALETTE.length];
  const initials = name
    .split(/[-_\s]+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="shrink-0 rounded-xl flex items-center justify-center font-semibold text-white tracking-wide ring-1 ring-black/5"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${a}, ${b})`, fontSize: size * 0.34 }}
      aria-hidden
    >
      {initials || "AI"}
    </div>
  );
}
