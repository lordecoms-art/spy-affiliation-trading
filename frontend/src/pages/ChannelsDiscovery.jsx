import { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw,
  Check,
  X,
  Eye,
  Users,
  Calendar,
  Loader2,
  SearchX,
  CheckSquare,
  Square,
  Minus,
} from 'lucide-react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import useAppStore from '../stores/appStore';

export default function ChannelsDiscovery() {
  const {
    pendingChannels,
    channelsLoading,
    syncing,
    fetchChannels,
    approveChannel,
    rejectChannel,
    syncTelegram,
  } = useAppStore();

  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Clear selection when pending list changes (after approve/reject)
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(pendingChannels.map((c) => c.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [pendingChannels]);

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === pendingChannels.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingChannels.map((c) => c.id)));
    }
  }, [selected.size, pendingChannels]);

  const bulkApprove = useCallback(async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    const ids = [...selected];
    for (const id of ids) {
      await approveChannel(id);
    }
    setSelected(new Set());
    setBulkLoading(false);
  }, [selected, approveChannel]);

  const bulkReject = useCallback(async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    const ids = [...selected];
    for (const id of ids) {
      await rejectChannel(id);
    }
    setSelected(new Set());
    setBulkLoading(false);
  }, [selected, rejectChannel]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const allSelected = pendingChannels.length > 0 && selected.size === pendingChannels.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">
            Review and approve newly discovered channels from Telegram.
          </p>
        </div>
        <button
          onClick={syncTelegram}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span>{syncing ? 'Syncing...' : 'Sync Telegram'}</span>
        </button>
      </div>

      {/* Selection bar */}
      {pendingChannels.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-emerald-500" />
              ) : someSelected ? (
                <Minus className="w-4 h-4 text-emerald-500" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>{allSelected ? 'Deselect all' : 'Select all'}</span>
            </button>
            <Badge variant="pending">{pendingChannels.length} pending</Badge>
            {selected.size > 0 && (
              <span className="text-sm text-emerald-500 font-medium">
                {selected.size} selected
              </span>
            )}
          </div>

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={bulkApprove}
                disabled={bulkLoading}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-500 rounded-lg text-sm font-medium transition-colors"
              >
                {bulkLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Approve {selected.size}</span>
              </button>
              <button
                onClick={bulkReject}
                disabled={bulkLoading}
                className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-500 rounded-lg text-sm font-medium transition-colors"
              >
                {bulkLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                <span>Reject {selected.size}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Channel Grid */}
      {channelsLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : pendingChannels.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <SearchX className="w-12 h-12 mb-4 text-zinc-600" />
            <p className="text-lg font-medium text-zinc-400 mb-1">
              No pending channels
            </p>
            <p className="text-sm">
              Click "Sync Telegram" to discover new channels.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingChannels.map((channel) => {
            const isSelected = selected.has(channel.id);
            return (
              <Card
                key={channel.id}
                className={`flex flex-col cursor-pointer transition-colors ${
                  isSelected
                    ? 'ring-1 ring-emerald-500/50 bg-emerald-500/5'
                    : ''
                }`}
                onClick={() => toggleSelect(channel.id)}
              >
                {/* Channel Info */}
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    {/* Checkbox */}
                    <div className="flex-shrink-0 pt-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Square className="w-5 h-5 text-zinc-600" />
                      )}
                    </div>
                    {channel.photo_url ? (
                      <img
                        src={channel.photo_url}
                        alt={channel.title}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-500 font-bold text-sm">
                          {(channel.title || '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h3 className="text-base font-semibold text-zinc-100 truncate">
                          {channel.title}
                        </h3>
                        <Badge variant="pending">Pending</Badge>
                      </div>
                      <p className="text-sm text-emerald-500">
                        {channel.username ? `@${channel.username}` : ''}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-zinc-400 mb-4 line-clamp-2">
                    {channel.description || 'No description available'}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      <span>
                        {(channel.subscribers_count || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(channel.discovered_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Source badge */}
                <div className="mt-4 mb-4">
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
                    Source: {channel.source || 'telegram'}
                  </span>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-2 pt-4 border-t border-zinc-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => approveChannel(channel.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => rejectChannel(channel.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-sm font-medium transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                  <button
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-colors"
                    title="Preview channel"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
