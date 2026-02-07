const variants = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
  info: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  warning: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  default: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',

  // Hook types
  urgency: 'bg-red-500/10 text-red-400 border-red-500/20',
  social_proof: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  authority: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  scarcity: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  reciprocity: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  curiosity: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  question: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  bold_claim: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  statistic: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  story: 'bg-lime-500/10 text-lime-400 border-lime-500/20',
  fear: 'bg-red-600/10 text-red-500 border-red-600/20',
  pain_point: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',

  // CTA types
  join_group: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  click_link: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  dm_me: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  use_code: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  link_click: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  join_channel: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  buy_product: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  sign_up: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  contact_dm: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  forward_message: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
};

export default function Badge({ variant = 'default', children, className = '' }) {
  const style = variants[variant] || variants.default;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style} ${className}`}
    >
      {children}
    </span>
  );
}
