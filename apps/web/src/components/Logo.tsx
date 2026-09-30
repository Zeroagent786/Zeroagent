import Image from "next/image";

export function Logo({ size = 32, label = true }: { size?: number; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src={size <= 32 ? "/logo-64.png" : "/logo.png"}
        alt="ZeroAgent"
        width={size}
        height={size}
        priority
        className="shrink-0 bg-black ring-1 ring-black/10 shadow-sm"
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }}
      />
      {label && <span className="font-[family-name:var(--font-brand)] font-semibold tracking-[0.08em] text-[15px] leading-none">ZEROAGENT</span>}
    </span>
  );
}
