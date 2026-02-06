import { useLocation } from 'react-router-dom';
import { Search, Bell, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';

const routeTitles = {
  '/': 'Dashboard',
  '/channels/discovery': 'Channel Discovery',
  '/channels': 'Tracked Channels',
  '/analysis': 'Message Analysis',
  '/insights': 'Insights & Patterns',
  '/settings': 'Settings',
};

export default function Header() {
  const location = useLocation();
  const [connected] = useState(true);

  const getTitle = () => {
    if (location.pathname.match(/^\/channels\/\d+/)) {
      return 'Channel Detail';
    }
    return routeTitles[location.pathname] || 'SPY Trading';
  };

  return (
    <header className="h-16 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-800 flex items-center justify-between px-6 sticky top-0 z-40">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">{getTitle()}</h1>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search channels, messages..."
            className="w-64 bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
        </button>

        {/* Connection Status */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            connected
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-red-500/10 text-red-500'
          }`}
        >
          {connected ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </header>
  );
}
