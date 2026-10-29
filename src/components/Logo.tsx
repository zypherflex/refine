// Mark: a lens over three rising refinery columns. Master files live in public/brand/.
export function LogoMark({ size = 28, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="rl-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b2ee8" />
          <stop offset="0.6" stopColor="#b33ce0" />
          <stop offset="1" stopColor="#ff7a1a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#rl-mark)" stroke={light ? "#ffffff" : "none"} strokeOpacity="0.5" strokeWidth="2" />
      <circle cx="30" cy="30" r="18" fill="none" stroke="#fff" strokeWidth="4" />
      <path d="M43.2 43.2L51 51" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
      <rect x="20.5" y="31" width="4.6" height="10" rx="1.2" fill="#fff" />
      <rect x="27.7" y="25" width="4.6" height="16" rx="1.2" fill="#fff" />
      <rect x="34.9" y="19" width="4.6" height="22" rx="1.2" fill="#fff" />
    </svg>
  );
}

export function Logo({ light = false, size = 28 }: { light?: boolean; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${light ? "text-white" : "text-ink-950"}`}>
      <LogoMark size={size} light={light} />
      <span className="text-[1.05rem] font-semibold tracking-[-0.01em]">
        Refinery
        <span className={`relative font-light ${light ? "text-[#ffd166]" : "bg-gradient-to-r from-brand-600 to-sun-500 bg-clip-text text-transparent"}`}>
          Lens
          {/* violet-to-orange rule under "Lens" */}
          <span aria-hidden className="absolute inset-x-px -bottom-1 h-[2px] rounded-full bg-gradient-to-r from-brand-500 to-sun-500" />
        </span>
      </span>
    </span>
  );
}
