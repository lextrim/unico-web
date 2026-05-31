export const BADGE_COLORS = {
  cascos:    { on: 'text-blue-400 bg-blue-500/10 border-blue-500/20',          off: 'text-slate-600 bg-slate-800/50 border-slate-700' },
  puertas:   { on: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', off: 'text-slate-600 bg-slate-800/50 border-slate-700' },
  tiradores: { on: 'text-amber-400 bg-amber-500/10 border-amber-500/20',        off: 'text-slate-600 bg-slate-800/50 border-slate-700' },
};

/**
 * @param size 'md' = w-10 h-6 (MaterialScreen, ListScreen) | 'sm' = w-9 h-5 (InformesScreen)
 */
export const getBadgeClass = (isActive: boolean, type: keyof typeof BADGE_COLORS, size: 'sm' | 'md' = 'md') => {
  const dims = size === 'sm' ? 'w-9 h-5 text-[8px] rounded' : 'w-10 h-6 text-[9px] rounded-md';
  return `${dims} flex items-center justify-center font-black tracking-tighter border transition-all shrink-0 ${
    isActive ? BADGE_COLORS[type].on : BADGE_COLORS[type].off
  } uppercase`;
};
