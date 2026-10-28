// Mark: a lens over three rising refinery columns. Master files live in public/brand/.
export function LogoMark({ size = 28, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="15" fill="#076339" stroke={light ? "#ffffff" : "none"} strokeOpacity="0.18" strokeWidth="2" />
      <path d="M0 15a15 15 0 0 1 15-15h34a15 15 0 0 1 15 15v9C44 18 20 18 0 30Z" fill="#2fbf78" fillOpacity="0.22" />
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
        <span className={`relative font-light ${light ? "text-brand-400" : "text-brand-700"}`}>
          Lens
          {/* green-white-green rule, the one national-colour cue in the mark */}
          <span aria-hidden className="absolute inset-x-px -bottom-1 flex h-[2px] overflow-hidden rounded-full">
            <span className="flex-1 bg-brand-500" />
            <span className={`flex-1 ${light ? "bg-white" : "bg-ink-200"}`} />
            <span className="flex-1 bg-brand-500" />
          </span>
        </span>
      </span>
    </span>
  );
}
