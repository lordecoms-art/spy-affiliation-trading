import { useEffect, useState, useMemo } from 'react';
import {
  GitCompare,
  Loader2,
  ChevronDown,
  Trophy,
  Sparkles,
  Clock,
  Type,
  Target,
  TrendingUp,
  Eye,
  Users,
  X,
  Plus,
} from 'lucide-react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import api from '../utils/api';
import useAppStore from '../stores/appStore';

// Channel colors for comparison columns
const CHANNEL_COLORS = [
  { bg: 'bg-emerald-500', text: 'text-emerald-500', light: 'bg-emerald-500/20', border: 'border-emerald-500/30', bar: 'bg-emerald-500' },
  { bg: 'bg-cyan-500', text: 'text-cyan-500', light: 'bg-cyan-500/20', border: 'border-cyan-500/30', bar: 'bg-cyan-500' },
  { bg: 'bg-purple-500', text: 'text-purple-500', light: 'bg-purple-500/20', border: 'border-purple-500/30', bar: 'bg-purple-500' },
];

function ChannelSelector({ index, selectedId, channels, onChange, onRemove, canRemove }) {
  const [open, setOpen] = useState(false);
  const selected = channels.find((c) => String(c.id) === String(selectedId));
  const color = CHANNEL_COLORS[index];

  return (
    <div className={`relative flex-1 min-w-[200px]`}>
      <div
        className={`flex items-center gap-3 p-3 rounded-xl border ${
          selected ? color.border : 'border-zinc-700'
        } bg-zinc-800/50 cursor-pointer hover:border-zinc-600 transition-colors`}
        onClick={() => setOpen(!open)}
      >
        {selected ? (
          <>
            {selected.photo_url ? (
              <img
                src={selected.photo_url}
                alt={selected.title}
                className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className={`w-8 h-8 rounded-lg ${color.light} flex items-center justify-center flex-shrink-0`}>
                <span className={`${color.text} font-bold text-sm`}>
                  {(selected.title || '?')[0].toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{selected.title}</p>
              <p className="text-xs text-zinc-500 truncate">
                {selected.username ? `@${selected.username}` : 'No username'}
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <Plus className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-zinc-500">Select channel {index + 1}</span>
          </div>
        )}
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        {canRemove && selected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 hover:bg-zinc-700 rounded-md transition-colors"
          >
            <X className="w-3 h-3 text-zinc-500" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => {
                onChange(ch.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-700/50 transition-colors ${
                String(ch.id) === String(selectedId) ? 'bg-zinc-700/30' : ''
              }`}
            >
              {ch.photo_url ? (
                <img
                  src={ch.photo_url}
                  alt={ch.title}
                  className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-zinc-400 font-bold text-xs">
                    {(ch.title || '?')[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div className="text-left min-w-0">
                <p className="text-sm text-zinc-200 truncate">{ch.title}</p>
                <p className="text-xs text-zinc-500">
                  {(ch.subscribers_count || 0).toLocaleString()} subs
                </p>
              </div>
            </button>
          ))}
          {channels.length === 0 && (
            <p className="text-sm text-zinc-500 p-4 text-center">No approved channels</p>
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonBar({ value, maxValue, color }) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex-1">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function MetricRow({ label, icon: Icon, values, format, winCondition = 'highest' }) {
  // Determine winner
  const numericValues = values.map((v) => (typeof v === 'number' ? v : 0));
  let winnerIndex = -1;
  if (numericValues.some((v) => v > 0)) {
    if (winCondition === 'highest') {
      const maxVal = Math.max(...numericValues);
      winnerIndex = numericValues.indexOf(maxVal);
    } else if (winCondition === 'lowest') {
      const nonZeroValues = numericValues.map((v, i) => (v > 0 ? v : Infinity));
      const minVal = Math.min(...nonZeroValues);
      winnerIndex = nonZeroValues.indexOf(minVal);
    }
  }

  const maxValue = Math.max(...numericValues, 1);

  return (
    <div className="flex items-start gap-4 py-4 border-b border-zinc-800/50 last:border-0">
      <div className="w-44 flex-shrink-0 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-zinc-500" />}
        <span className="text-sm text-zinc-400">{label}</span>
      </div>
      <div className="flex-1 grid gap-4" style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)` }}>
        {values.map((val, i) => {
          const isWinner = i === winnerIndex && numericValues.filter((v) => v === numericValues[winnerIndex]).length === 1;
          const displayVal = format ? format(val) : val;
          return (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    isWinner ? 'text-amber-400' : 'text-zinc-200'
                  }`}
                >
                  {displayVal}
                </span>
                {isWinner && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <ComparisonBar
                value={typeof val === 'number' ? val : 0}
                maxValue={maxValue}
                color={CHANNEL_COLORS[i]?.bar || 'bg-zinc-500'}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListMetricRow({ label, icon: Icon, channelData }) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-zinc-800/50 last:border-0">
      <div className="w-44 flex-shrink-0 flex items-center gap-2 pt-0.5">
        {Icon && <Icon className="w-4 h-4 text-zinc-500" />}
        <span className="text-sm text-zinc-400">{label}</span>
      </div>
      <div className="flex-1 grid gap-4" style={{ gridTemplateColumns: `repeat(${channelData.length}, 1fr)` }}>
        {channelData.map((items, i) => (
          <div key={i} className="flex flex-wrap gap-1.5">
            {(items || []).map((item, j) => (
              <Badge key={j} variant="default" className={CHANNEL_COLORS[i]?.border}>
                {item}
              </Badge>
            ))}
            {(!items || items.length === 0) && (
              <span className="text-xs text-zinc-600">No data</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BarMetricRow({ label, icon: Icon, channelData }) {
  // channelData is an array of arrays like [{ type, count }]
  // Gather all unique types across channels
  const allTypes = new Set();
  channelData.forEach((items) => {
    (items || []).forEach((item) => allTypes.add(item.type));
  });
  const types = Array.from(allTypes);

  if (types.length === 0) {
    return (
      <div className="flex items-start gap-4 py-4 border-b border-zinc-800/50 last:border-0">
        <div className="w-44 flex-shrink-0 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-zinc-500" />}
          <span className="text-sm text-zinc-400">{label}</span>
        </div>
        <div className="flex-1">
          <span className="text-xs text-zinc-600">No data</span>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(
    ...channelData.flatMap((items) => (items || []).map((item) => item.count || 0)),
    1
  );

  return (
    <div className="flex items-start gap-4 py-4 border-b border-zinc-800/50 last:border-0">
      <div className="w-44 flex-shrink-0 flex items-center gap-2 pt-0.5">
        {Icon && <Icon className="w-4 h-4 text-zinc-500" />}
        <span className="text-sm text-zinc-400">{label}</span>
      </div>
      <div className="flex-1 space-y-2">
        {types.slice(0, 6).map((type) => (
          <div key={type} className="space-y-1">
            <span className="text-xs text-zinc-500 capitalize">{type.replace(/_/g, ' ')}</span>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${channelData.length}, 1fr)` }}>
              {channelData.map((items, i) => {
                const item = (items || []).find((it) => it.type === type);
                const count = item?.count || 0;
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${CHANNEL_COLORS[i]?.bar || 'bg-zinc-500'} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContentTypeRow({ channelData }) {
  const allTypes = new Set();
  channelData.forEach((items) => {
    (items || []).forEach((item) => allTypes.add(item.type));
  });
  const types = Array.from(allTypes);

  if (types.length === 0) return null;

  return (
    <div className="flex items-start gap-4 py-4 border-b border-zinc-800/50 last:border-0">
      <div className="w-44 flex-shrink-0 flex items-center gap-2 pt-0.5">
        <Type className="w-4 h-4 text-zinc-500" />
        <span className="text-sm text-zinc-400">Content types</span>
      </div>
      <div className="flex-1 grid gap-4" style={{ gridTemplateColumns: `repeat(${channelData.length}, 1fr)` }}>
        {channelData.map((items, i) => (
          <div key={i} className="space-y-1.5">
            {(items || []).slice(0, 5).map((item) => (
              <div key={item.type} className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 capitalize">{item.type}</span>
                <span className={`text-xs font-medium ${CHANNEL_COLORS[i]?.text || 'text-zinc-300'}`}>
                  {item.pct}%
                </span>
              </div>
            ))}
            {(!items || items.length === 0) && (
              <span className="text-xs text-zinc-600">No data</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Comparator() {
  const { channels, fetchChannels, channelsLoading } = useAppStore();
  const [selectedIds, setSelectedIds] = useState([null, null]);
  const [personas, setPersonas] = useState({});
  const [loading, setLoading] = useState({});

  useEffect(() => {
    if (channels.length === 0 && !channelsLoading) {
      fetchChannels();
    }
  }, [channels.length, channelsLoading, fetchChannels]);

  // Fetch persona when a channel is selected
  const fetchPersona = async (channelId) => {
    if (!channelId || personas[channelId]) return;
    setLoading((prev) => ({ ...prev, [channelId]: true }));
    try {
      const response = await api.get(`/persona/${channelId}`);
      setPersonas((prev) => ({ ...prev, [channelId]: response.data }));
    } catch (error) {
      console.error('Failed to fetch persona for channel', channelId, error);
    }
    setLoading((prev) => ({ ...prev, [channelId]: false }));
  };

  const handleSelectChannel = (index, channelId) => {
    const newIds = [...selectedIds];
    newIds[index] = channelId;
    setSelectedIds(newIds);
    fetchPersona(channelId);
  };

  const handleRemoveChannel = (index) => {
    const newIds = [...selectedIds];
    newIds[index] = null;
    setSelectedIds(newIds);
  };

  const addSlot = () => {
    if (selectedIds.length < 3) {
      setSelectedIds([...selectedIds, null]);
    }
  };

  const removeSlot = (index) => {
    if (selectedIds.length > 2) {
      const newIds = selectedIds.filter((_, i) => i !== index);
      setSelectedIds(newIds);
    } else {
      handleRemoveChannel(index);
    }
  };

  // Get active personas (selected and loaded)
  const activePersonas = useMemo(() => {
    return selectedIds
      .filter((id) => id && personas[id])
      .map((id) => personas[id]);
  }, [selectedIds, personas]);

  const activeIds = selectedIds.filter((id) => id && personas[id]);
  const isLoading = Object.values(loading).some((v) => v);
  const hasComparison = activePersonas.length >= 2;

  // Helper to extract a metric from each active persona
  const getMetrics = (accessor) => {
    return selectedIds.map((id) => {
      if (!id || !personas[id]) return 0;
      return accessor(personas[id]) ?? 0;
    }).filter((_, i) => selectedIds[i] && personas[selectedIds[i]]);
  };

  const getListMetrics = (accessor) => {
    return selectedIds
      .filter((id) => id && personas[id])
      .map((id) => accessor(personas[id]) ?? []);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <GitCompare className="w-6 h-6 text-emerald-500" />
          </div>
          Channel Comparator
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Compare up to 3 channels side by side to identify best strategies
        </p>
      </div>

      {/* Channel Selectors */}
      <Card>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">Select channels to compare</h3>
        <div className="flex gap-3 flex-wrap">
          {selectedIds.map((id, index) => (
            <ChannelSelector
              key={index}
              index={index}
              selectedId={id}
              channels={channels}
              onChange={(channelId) => handleSelectChannel(index, channelId)}
              onRemove={() => removeSlot(index)}
              canRemove={selectedIds.length > 2}
            />
          ))}
          {selectedIds.length < 3 && (
            <button
              onClick={addSlot}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-zinc-700 hover:border-zinc-600 text-zinc-500 hover:text-zinc-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add channel</span>
            </button>
          )}
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 mt-3 text-sm text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
            Loading persona data...
          </div>
        )}
      </Card>

      {/* Comparison Table */}
      {hasComparison && (
        <>
          {/* Column Headers */}
          <Card>
            <div className="flex items-start gap-4">
              <div className="w-44 flex-shrink-0" />
              <div
                className="flex-1 grid gap-4"
                style={{ gridTemplateColumns: `repeat(${activePersonas.length}, 1fr)` }}
              >
                {activePersonas.map((p, i) => (
                  <div key={p.channel.id} className="flex items-center gap-3">
                    {p.channel.photo_url ? (
                      <img
                        src={p.channel.photo_url}
                        alt={p.channel.title}
                        className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-xl ${CHANNEL_COLORS[i]?.light} flex items-center justify-center flex-shrink-0`}>
                        <span className={`${CHANNEL_COLORS[i]?.text} font-bold`}>
                          {(p.channel.title || '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${CHANNEL_COLORS[i]?.text || 'text-zinc-200'} truncate`}>
                        {p.channel.title}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {(p.channel.subscribers_count || 0).toLocaleString()} subs
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Publication Rhythm */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-zinc-800">
                <Clock className="w-4 h-4 text-purple-500" />
              </div>
              <h3 className="text-base font-semibold text-zinc-100">Publication Rhythm</h3>
            </div>

            <MetricRow
              label="Avg posts/day"
              icon={null}
              values={getMetrics((p) => p.publication_rhythm.avg_posts_per_day)}
              format={(v) => v}
              winCondition="highest"
            />
            <MetricRow
              label="Min posts/day"
              icon={null}
              values={getMetrics((p) => p.publication_rhythm.min_posts_per_day)}
              format={(v) => v}
              winCondition="highest"
            />
            <MetricRow
              label="Max posts/day"
              icon={null}
              values={getMetrics((p) => p.publication_rhythm.max_posts_per_day)}
              format={(v) => v}
              winCondition="highest"
            />

            <ListMetricRow
              label="Top 3 hours"
              icon={Clock}
              channelData={getListMetrics((p) => {
                const hours = [...(p.publication_rhythm.posting_hours || [])];
                hours.sort((a, b) => b.count - a.count);
                return hours.slice(0, 3).map((h) => `${h.hour}h (${h.pct}%)`);
              })}
            />

            <ListMetricRow
              label="Top 3 days"
              icon={null}
              channelData={getListMetrics((p) => {
                return (p.publication_rhythm.active_days || [])
                  .slice(0, 3)
                  .map((d) => `${d.day} (${d.pct}%)`);
              })}
            />

            <ContentTypeRow
              channelData={getListMetrics((p) => p.publication_rhythm.content_types || [])}
            />
          </Card>

          {/* Writing Style */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-zinc-800">
                <Type className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-base font-semibold text-zinc-100">Writing Style</h3>
            </div>

            <MetricRow
              label="Avg msg length"
              icon={null}
              values={getMetrics((p) => p.writing_style.avg_message_length)}
              format={(v) => `${v} chars`}
              winCondition="highest"
            />
            <MetricRow
              label="Emoji / message"
              icon={null}
              values={getMetrics((p) => p.writing_style.emoji_per_message)}
              format={(v) => v}
              winCondition="highest"
            />
            <MetricRow
              label="Messages w/ emojis"
              icon={null}
              values={getMetrics((p) => p.writing_style.messages_with_emojis_pct)}
              format={(v) => `${v}%`}
              winCondition="highest"
            />
          </Card>

          {/* Message Structure */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-zinc-800">
                <Target className="w-4 h-4 text-emerald-500" />
              </div>
              <h3 className="text-base font-semibold text-zinc-100">Message Structure</h3>
            </div>

            <BarMetricRow
              label="Hook types"
              icon={Target}
              channelData={getListMetrics((p) => p.message_structure.hook_types || [])}
            />

            <BarMetricRow
              label="CTA types"
              icon={null}
              channelData={getListMetrics((p) => p.message_structure.cta_types || [])}
            />
          </Card>

          {/* Engagement & Scores */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-zinc-800">
                <TrendingUp className="w-4 h-4 text-rose-500" />
              </div>
              <h3 className="text-base font-semibold text-zinc-100">Engagement & Performance</h3>
            </div>

            <MetricRow
              label="Avg engagement"
              icon={null}
              values={getMetrics((p) => p.message_structure.avg_engagement)}
              format={(v) => `${v}/10`}
              winCondition="highest"
            />
            <MetricRow
              label="Avg virality"
              icon={null}
              values={getMetrics((p) => p.message_structure.avg_virality)}
              format={(v) => `${v}/10`}
              winCondition="highest"
            />
            <MetricRow
              label="Top views"
              icon={Eye}
              values={getMetrics((p) => {
                const topMsg = (p.engagement.top_messages || [])[0];
                return topMsg?.views || 0;
              })}
              format={(v) => v.toLocaleString()}
              winCondition="highest"
            />
            <MetricRow
              label="Subscribers"
              icon={Users}
              values={getMetrics((p) => p.channel.subscribers_count || 0)}
              format={(v) => v.toLocaleString()}
              winCondition="highest"
            />
            <MetricRow
              label="Total messages"
              icon={null}
              values={getMetrics((p) => p.publication_rhythm.total_messages)}
              format={(v) => v.toLocaleString()}
              winCondition="highest"
            />
            <MetricRow
              label="Analyzed messages"
              icon={null}
              values={getMetrics((p) => p.message_structure.total_analyzed)}
              format={(v) => v.toLocaleString()}
              winCondition="highest"
            />
          </Card>

          {/* AI Comparison Button */}
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Sparkles className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">AI Comparison</h3>
                  <p className="text-sm text-zinc-500">
                    Get an AI-generated comparative analysis of these channels
                  </p>
                </div>
              </div>
              <div className="relative group">
                <button
                  disabled
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-700 text-zinc-500 rounded-lg font-medium cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate AI Comparison
                </button>
                <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-zinc-700 text-zinc-300 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  Coming soon
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!hasComparison && !isLoading && (
        <Card className="py-16">
          <div className="text-center">
            <GitCompare className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-400 mb-2">
              Select at least 2 channels to compare
            </h3>
            <p className="text-sm text-zinc-600 max-w-md mx-auto">
              Choose channels from the dropdowns above to see a side-by-side comparison
              of their publication rhythm, writing style, engagement metrics, and more.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
