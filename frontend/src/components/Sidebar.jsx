import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Radio,
  MessageSquare,
  Lightbulb,
  BookOpen,
  GitCompare,
  Sparkles,
  Settings,
  TrendingUp,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Discovery', path: '/channels/discovery', icon: Search },
  { name: 'Channels', path: '/channels', icon: Radio },
  { name: 'Analysis', path: '/analysis', icon: MessageSquare },
  { name: 'Insights', path: '/insights', icon: Lightbulb },
  { name: 'Swipe File', path: '/swipe-file', icon: BookOpen },
  { name: 'Compare', path: '/compare', icon: GitCompare },
  { name: 'Generator', path: '/generator', icon: Sparkles },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col z-50">
      {/* Brand */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-zinc-800">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <span className="text-lg font-bold text-zinc-100 tracking-tight">
            SPY
          </span>
          <span className="text-lg font-bold text-emerald-500 tracking-tight">
            {' '}
            Trading
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/' || item.path === '/channels'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={`w-5 h-5 ${
                    isActive
                      ? 'text-emerald-500'
                      : 'text-zinc-500 group-hover:text-zinc-300'
                  }`}
                />
                <span>{item.name}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-xs font-medium text-zinc-400">SA</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-300 truncate">
              Spy Affiliate
            </p>
            <p className="text-xs text-zinc-500">Pro Plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
