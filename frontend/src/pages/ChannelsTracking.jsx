import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Filter, Radio } from 'lucide-react';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import useAppStore from '../stores/appStore';

export default function ChannelsTracking() {
  const navigate = useNavigate();
  const { channels, channelsLoading, fetchChannels } = useAppStore();
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    fetchChannels();
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
      render: (value) => {
        const v = value || 0;
        if (v >= 1000000) return <span className="font-medium text-zinc-200">{(v / 1000000).toFixed(1)}M</span>;
        if (v >= 1000) return <span className="font-medium text-zinc-200">{(v / 1000).toFixed(1)}K</span>;
        return <span className="font-medium text-zinc-200">{v.toLocaleString()}</span>;
      },
    },
    {
      key: 'growth_7d',
      label: 'Growth 7d',
      render: (value) => {
        const isPositive = (value || 0) >= 0;
        return (
          <div
            className={`flex items-center gap-1 ${
              isPositive ? 'text-emerald-500' : 'text-red-500'
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span className="font-medium">
              {isPositive ? '+' : ''}
              {value || 0}%
            </span>
          </div>
        );
      },
    },
    {
      key: 'messages_per_day',
      label: 'Msgs/Day',
      render: (value) => (
        <span className="text-zinc-300">{value || 0}</span>
      ),
    },
    {
      key: 'avg_engagement',
      label: 'Avg Engagement',
      render: (value) => {
        const v = value || 0;
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
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
      key: 'status',
      label: 'Status',
      render: (value) => <Badge variant={value || 'default'}>{value}</Badge>,
      sortable: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {filteredChannels.length} channels being tracked
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

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredChannels}
        onRowClick={(row) => navigate(`/channels/${row.id}`)}
        emptyMessage="No approved channels yet. Discover and approve channels first."
        emptyIcon={Radio}
      />
    </div>
  );
}
