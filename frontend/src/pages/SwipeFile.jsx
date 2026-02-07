import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Copy,
  Check,
  Sparkles,
  Filter,
  SortAsc,
  Eye,
  Forward,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  Search,
  Zap,
  TrendingUp,
} from 'lucide-react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import api from '../utils/api';

const HOOK_TYPES = [
  { value: 'question', label: 'Question' },
  { value: 'bold_claim', label: 'Bold Claim' },
  { value: 'statistic', label: 'Statistic' },
  { value: 'story', label: 'Story' },
  { value: 'urgency', label: 'Urgency' },
  { value: 'fear', label: 'Fear' },
  { value: 'curiosity', label: 'Curiosity' },
  { value: 'social_proof', label: 'Social Proof' },
  { value: 'authority', label: 'Authority' },
  { value: 'pain_point', label: 'Pain Point' },
];

const CTA_TYPES = [
  { value: 'link_click', label: 'Link Click' },
  { value: 'join_channel', label: 'Join Channel' },
  { value: 'buy_product', label: 'Buy Product' },
  { value: 'sign_up', label: 'Sign Up' },
  { value: 'contact_dm', label: 'Contact DM' },
  { value: 'forward_message', label: 'Forward Message' },
];

const ENGAGEMENT_LEVELS = [
  { value: '', label: 'All Scores' },
  { value: '3', label: '3+ (Average)' },
  { value: '5', label: '5+ (Good)' },
  { value: '7', label: '7+ (Great)' },
  { value: '8', label: '8+ (Excellent)' },
  { value: '9', label: '9+ (Top Tier)' },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'views', label: 'Most Views' },
  { value: 'engagement', label: 'Highest Engagement' },
  { value: 'virality', label: 'Highest Virality' },
];

const PAGE_SIZE = 20;

function formatNumber(num) {
  if (num == null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

function formatLabel(str) {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ScoreBar({ value, max = 10, color = 'emerald' }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full bg-${color}-500 rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-zinc-400 w-8 text-right">
        {value?.toFixed(1)}
      </span>
    </div>
  );
}

function SwipeCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const text = item.message_text || '';
  const isLong = text.length > 280;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="flex flex-col gap-4 hover:border-zinc-700 transition-colors">
      {/* Header: Channel info */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-zinc-400">
            {(item.channel_title || '?')[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200 truncate">
            {item.channel_title || `Channel #${item.channel_id}`}
          </p>
          {item.analyzed_at && (
            <p className="text-xs text-zinc-500">
              {new Date(item.analyzed_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>

      {/* Message text */}
      <div className="relative">
        <p
          className={`text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-words ${
            !expanded && isLong ? 'max-h-32 overflow-hidden' : ''
          }`}
        >
          {text || <span className="text-zinc-600 italic">No text content</span>}
        </p>
        {isLong && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-zinc-900 to-transparent" />
        )}
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Show more
              </>
            )}
          </button>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {item.hook_type && item.hook_type !== 'none' && (
          <Badge variant={item.hook_type}>
            {formatLabel(item.hook_type)}
          </Badge>
        )}
        {item.cta_type && item.cta_type !== 'none' && (
          <Badge variant={item.cta_type}>
            {formatLabel(item.cta_type)}
          </Badge>
        )}
        {item.tone && (
          <Badge variant="info">
            {formatLabel(item.tone)}
          </Badge>
        )}
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-zinc-500 mb-1">Engagement</p>
          <ScoreBar value={item.engagement_score || 0} color="emerald" />
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-1">Virality</p>
          <ScoreBar value={item.virality_potential || 0} color="cyan" />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 pt-1 border-t border-zinc-800/50">
        <div className="flex items-center gap-1.5 text-zinc-500">
          <Eye className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{formatNumber(item.views_count)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-500">
          <Forward className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{formatNumber(item.forwards_count)}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              copied
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 border border-zinc-700'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
          <div className="relative group">
            <button
              disabled
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/50 text-zinc-600 border border-zinc-800 cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Variant
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-md bg-zinc-700 text-xs text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Coming soon
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-700 rotate-45 -mt-1" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function SwipeFile() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [channels, setChannels] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [channelId, setChannelId] = useState('');
  const [hookType, setHookType] = useState('');
  const [ctaType, setCtaType] = useState('');
  const [minEngagement, setMinEngagement] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  // Track offset for pagination
  const [offset, setOffset] = useState(0);

  // Fetch approved channels for filter dropdown
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await api.get('/channels/approved');
        setChannels(response.data?.channels || response.data || []);
      } catch (err) {
        // Fallback: fetch all and filter client-side
        try {
          const response = await api.get('/channels/', { params: { limit: 200 } });
          const all = response.data?.channels || response.data || [];
          setChannels(all.filter((c) => c.status === 'approved'));
        } catch {
          setChannels([]);
        }
      }
    };
    fetchChannels();
  }, []);

  const buildParams = useCallback(
    (skip = 0) => {
      const params = { skip, limit: PAGE_SIZE };
      if (channelId) params.channel_id = channelId;
      if (hookType) params.hook_type = hookType;
      if (ctaType) params.cta_type = ctaType;
      if (minEngagement) params.min_engagement = parseFloat(minEngagement);
      return params;
    },
    [channelId, hookType, ctaType, minEngagement]
  );

  const sortItems = useCallback(
    (data) => {
      const sorted = [...data];
      switch (sortBy) {
        case 'views':
          sorted.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
          break;
        case 'engagement':
          sorted.sort(
            (a, b) => (b.engagement_score || 0) - (a.engagement_score || 0)
          );
          break;
        case 'virality':
          sorted.sort(
            (a, b) => (b.virality_potential || 0) - (a.virality_potential || 0)
          );
          break;
        case 'recent':
        default:
          // API already returns by analyzed_at desc
          break;
      }
      return sorted;
    },
    [sortBy]
  );

  // Fetch data (initial or after filter change)
  const fetchData = useCallback(async () => {
    setLoading(true);
    setOffset(0);
    try {
      const params = buildParams(0);
      const response = await api.get('/analysis/', { params });
      const data = response.data?.results || response.data || [];
      setItems(sortItems(data));
      setHasMore(data.length >= PAGE_SIZE);
    } catch (error) {
      console.error('Failed to fetch swipe file data:', error);
      setItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [buildParams, sortItems]);

  // Re-fetch when filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load more
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextOffset = offset + PAGE_SIZE;
    try {
      const params = buildParams(nextOffset);
      const response = await api.get('/analysis/', { params });
      const data = response.data?.results || response.data || [];
      setItems((prev) => sortItems([...prev, ...data]));
      setOffset(nextOffset);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (error) {
      console.error('Failed to load more:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const activeFilterCount = [channelId, hookType, ctaType, minEngagement].filter(
    Boolean
  ).length;

  const clearFilters = () => {
    setChannelId('');
    setHookType('');
    setCtaType('');
    setMinEngagement('');
  };

  const selectClass =
    'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 appearance-none cursor-pointer';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Swipe File</h1>
            <p className="text-sm text-zinc-500">
              Browse and copy high-performing messages from your tracked channels
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Sort dropdown */}
          <div className="flex items-center gap-2">
            <SortAsc className="w-4 h-4 text-zinc-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={selectClass}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
              showFilters || activeFilterCount > 0
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-emerald-500 text-zinc-950 text-xs font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <Card className="!p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Channel filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Channel
              </label>
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className={selectClass + ' min-w-[180px]'}
              >
                <option value="">All Channels</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title || ch.username || `Channel #${ch.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Hook type filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Hook Type
              </label>
              <select
                value={hookType}
                onChange={(e) => setHookType(e.target.value)}
                className={selectClass + ' min-w-[160px]'}
              >
                <option value="">All Hooks</option>
                {HOOK_TYPES.map((ht) => (
                  <option key={ht.value} value={ht.value}>
                    {ht.label}
                  </option>
                ))}
              </select>
            </div>

            {/* CTA type filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                CTA Type
              </label>
              <select
                value={ctaType}
                onChange={(e) => setCtaType(e.target.value)}
                className={selectClass + ' min-w-[160px]'}
              >
                <option value="">All CTAs</option>
                {CTA_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Min engagement filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Min Engagement
              </label>
              <select
                value={minEngagement}
                onChange={(e) => setMinEngagement(e.target.value)}
                className={selectClass + ' min-w-[150px]'}
              >
                {ENGAGEMENT_LEVELS.map((lvl) => (
                  <option key={lvl.value} value={lvl.value}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear all
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Summary stats */}
      {!loading && items.length > 0 && (
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-zinc-400">
            <Search className="w-4 h-4 text-zinc-500" />
            <span>
              <span className="font-semibold text-zinc-200">{items.length}</span>{' '}
              {items.length === 1 ? 'message' : 'messages'} found
            </span>
          </div>
          {items.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-zinc-400">
                <Zap className="w-4 h-4 text-emerald-500" />
                <span>
                  Avg engagement:{' '}
                  <span className="font-semibold text-zinc-200">
                    {(
                      items.reduce(
                        (sum, i) => sum + (i.engagement_score || 0),
                        0
                      ) / items.length
                    ).toFixed(1)}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-zinc-400">
                <TrendingUp className="w-4 h-4 text-cyan-500" />
                <span>
                  Avg virality:{' '}
                  <span className="font-semibold text-zinc-200">
                    {(
                      items.reduce(
                        (sum, i) => sum + (i.virality_potential || 0),
                        0
                      ) / items.length
                    ).toFixed(1)}
                  </span>
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-500">Loading swipe file...</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-300 mb-2">
            No messages found
          </h3>
          <p className="text-sm text-zinc-500 text-center max-w-md">
            {activeFilterCount > 0
              ? 'Try adjusting your filters to find more messages.'
              : 'Analyzed messages will appear here. Make sure you have channels tracked and analysis has been run.'}
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
            >
              <X className="w-4 h-4" />
              Clear filters
            </button>
          )}
        </Card>
      )}

      {/* Card grid */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <SwipeCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Load more */}
      {!loading && hasMore && items.length > 0 && (
        <div className="flex justify-center pt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 border border-zinc-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load more messages'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
