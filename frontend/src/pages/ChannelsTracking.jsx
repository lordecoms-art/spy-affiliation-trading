import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Filter, Radio, Loader2, Info, X } from 'lucide-react';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import useAppStore from '../stores/appStore';
import api from '../utils/api';

function MiniSparkline({ data }) {
  if (!data || data.length < 2) return <span className="text-zinc-600 text-xs">—</span>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 64;
  const h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  const isUp = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? '#10b981' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GrowthCell({ absolute, pct }) {
  if (absolute === 0 && pct === 0) {
    return <span className="text-zinc-500 text-xs italic">0</span>;
  }
  const isPositive = absolute >= 0;
  return (
    <div className={`flex items-center gap-1 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
      {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      <span className="font-medium text-sm">
        {isPositive ? '+' : ''}{absolute}
      </span>
      <span className="text-xs opacity-70">
        ({isPositive ? '+' : ''}{pct}%)
      </span>
    </div>
  );
}

export default function ChannelsTracking() {
  const navigate = useNavigate();
  const { channels, channelsLoading, fetchChannels, rejectChannel } = useAppStore();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [growthData, setGrowthData] = useState({});
  const [growthLoading, setGrowthLoading] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(null);

  useEffect(() => {
    fetchChannels();
    api
      .get('/stats/growth')
      .then((r) => {
        const map = {};
        for (const item of r.data || []) {
          map[item.channel_id] = item;
        }
        setGrowthData(map);
      })
      .catch(() => {})
      .finally(() => setGrowthLoading(false));
  }, [fetchChannels]);

  const categories = [
    'all',
    ...new Set(channels.map((c) => c.category).filter(Boolean)),
  ];

  const filteredChannels =
    categoryFilter === 'all'
      ? channels
      : channels.filter((c) => c.category === categoryFilter);

  const columns = [
    {
      key: 'title',
      label: 'Channel',
      render: (value, row) => (
        <div className="flex items-center gap-3">
          {row.photo_url ? (
            <img
              src={row.photo_url}
              alt={value}
              className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-500 font-bold text-sm">
                {(value || '?')[0].toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="font-medium text-zinc-200">{value}</p>
            <p className="text-xs text-zinc-500">{row.username ? `@${row.username}` : ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (value) => <Badge variant="info">{value || 'N/A'}</Badge>,
    },
    {
      key: 'subscribers_count',
      label: 'Subscribers',
      render: (value, row) => {
        const g = growthData[row.id];
        const v = g?.subscribers_count || value || 0;
        let display;
        if (v >= 1000000) display = `${(v / 1000000).toFixed(1)}M`;
        else if (v >= 1000) display = `${(v / 1000).toFixed(1)}K`;
        else display = v.toLocaleString();
        return <span className="font-medium text-zinc-200">{display}</span>;
      },
    },
    {
      key: 'growth_24h',
      label: '+/- 24h',
      render: (_value, row) => {
        const g = growthData[row.id];
        if (!g || g.snapshots_count < 2) return <span className="text-zinc-500 text-xs italic">En attente</span>;
        return <GrowthCell absolute={g.growth_24h} pct={g.growth_24h_pct} />;
      },
    },
    {
      key: 'growth_7d',
      label: '+/- 7d',
      render: (_value, row) => {
        const g = growthData[row.id];
        if (!g || g.snapshots_count < 2) return <span className="text-zinc-500 text-xs italic">En attente</span>;
        return <GrowthCell absolute={g.growth_7d} pct={g.growth_7d_pct} />;
      },
    },
    {
      key: 'growth_30d',
      label: '+/- 30d',
      render: (_value, row) => {
        const g = growthData[row.id];
        if (!g || g.snapshots_count < 2) return <span className="text-zinc-500 text-xs italic">En attente</span>;
        return <GrowthCell absolute={g.growth_30d} pct={g.growth_30d_pct} />;
      },
    },
    {
      key: 'avg_daily_30d',
      label: 'Avg/jour',
      render: (_value, row) => {
        const g = growthData[row.id];
        if (!g || g.snapshots_count < 2) return <span className="text-zinc-500 text-xs italic">En attente</span>;
        const v = g.avg_daily_30d || 0;
        if (v === 0) return <span className="text-zinc-500 text-xs italic">0/j</span>;
        const isPositive = v >= 0;
        return (
          <span className={`font-medium text-sm ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{v}/j
          </span>
        );
      },
    },
    {
      key: 'sparkline',
      label: 'Tendance',
      render: (_value, row) => {
        const g = growthData[row.id];
        return <MiniSparkline data={g?.sparkline} />;
      },
      sortable: false,
    },
    {
      key: 'avg_engagement',
      label: 'Engagement',
      render: (value) => {
        const v = value || 0;
        return (
          <div className="flex items-center gap-2">
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(v * 10, 100)}%` }}
              />
            </div>
            <span className="text-zinc-300 text-xs">{v.toFixed(1)}</span>
          </div>
        );
      },
    },
    {
      key: 'remove',
      label: '',
      render: (_value, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirmRemove(row);
          }}
          className="p-1 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-colors"
          title="Retirer de la liste"
        >
          <X className="w-4 h-4" />
        </button>
      ),
      sortable: false,
    },
  ];

  // Find earliest first_snapshot date across all channels
  const firstSnapshotDate = Object.values(growthData)
    .map((g) => g.first_snapshot)
    .filter(Boolean)
    .sort()[0];

  const maxSnapshots = Math.max(0, ...Object.values(growthData).map((g) => g.snapshots_count || 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {filteredChannels.length} channels being tracked
          {growthLoading && (
            <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin inline ml-2" />
          )}
        </p>
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-zinc-500" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:border-emerald-500/50"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Data freshness notice */}
      {firstSnapshotDate && maxSnapshots < 8 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-zinc-800/50 border border-zinc-800">
          <Info className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-500">
            Données de croissance disponibles depuis le{' '}
            <span className="text-zinc-400 font-medium">
              {new Date(firstSnapshotDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            . Les tendances 7j et 30j seront précises après suffisamment d'historique
            ({maxSnapshots} snapshot{maxSnapshots > 1 ? 's' : ''} collecté{maxSnapshots > 1 ? 's' : ''}).
          </p>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredChannels}
        onRowClick={(row) => navigate(`/channels/${row.id}`)}
        emptyMessage="No approved channels yet. Discover and approve channels first."
        emptyIcon={Radio}
      />

      {/* Confirmation modal */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">
              Retirer ce channel ?
            </h3>
            <p className="text-sm text-zinc-400 mb-1">
              <span className="font-medium text-zinc-200">{confirmRemove.title}</span>
            </p>
            <p className="text-xs text-zinc-500 mb-6">
              Le channel sera retiré de votre liste de suivi. Vous pourrez le ré-approuver plus tard depuis la page Discover.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  rejectChannel(confirmRemove.id);
                  setConfirmRemove(null);
                }}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
              >
                Retirer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
