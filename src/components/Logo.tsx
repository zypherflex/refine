export function LogoMark({ size = 28, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="8" fill={light ? "#ffffff" : "#0a1628"} fillOpacity={light ? 0.08 : 1} stroke={light ? "#ffffff" : "none"} strokeOpacity="0.14" />
      <circle cx="14.5" cy="14.5" r="7.5" fill="none" stroke="#fff" strokeWidth="2.2" />
      <path d="M10.5 16.5l2.6-3 2.2 1.6 3.2-4.4" fill="none" stroke="#3fc1b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.2 20.2l5 5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ light = false, size = 28 }: { light?: boolean; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${light ? "text-white" : "text-navy-950"}`}>
      <LogoMark size={size} light={light} />
      <span className="text-[1.05rem] font-semibold tracking-[-0.01em]">
        Refinery<span className={light ? "text-teal-400" : "text-teal-700"}>Lens</span>
      </span>
    </span>
  );
}
