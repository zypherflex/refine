export function LogoMark({ size = 28, light = false }: { size?: number; light?: boolean }) {
  // Violet-to-orange tile; on a coloured background (`light`) it gets a thin white edge so it stays distinct.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="rl-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b2ee8" />
          <stop offset="0.6" stopColor="#b33ce0" />
          <stop offset="1" stopColor="#ff7a1a" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#rl-mark)" stroke={light ? "#ffffff" : "none"} strokeOpacity="0.5" />
      <circle cx="14.5" cy="14.5" r="7.5" fill="none" stroke="#fff" strokeWidth="2.2" />
      <path d="M10.5 16.5l2.6-3 2.2 1.6 3.2-4.4" fill="none" stroke="#ffd166" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.2 20.2l5 5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ light = false, size = 28 }: { light?: boolean; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${light ? "text-white" : "text-navy-950"}`}>
      <LogoMark size={size} light={light} />
      <span className="text-[1.05rem] font-semibold tracking-[-0.01em]">
        Refinery<span className={light ? "text-sun-300" : "bg-gradient-to-r from-brand-600 to-sun-500 bg-clip-text text-transparent"}>Lens</span>
      </span>
    </span>
  );
}
