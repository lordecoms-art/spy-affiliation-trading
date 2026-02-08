import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio,
  MessageSquare,
  Brain,
  MousePointerClick,
  TrendingUp,
  Eye,
  ArrowUpRight,
  Clock,
  Flame,
  Zap,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import StatCard from '../components/StatCard';
import Card from '../components/Card';
import Badge from '../components/Badge';
import useAppStore from '../stores/appStore';
import api from '../utils/api';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl">
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        <p className="text-sm text-emerald-400">
          {payload[0].value.toLocaleString()} subscribers
        </p>
      </div>
    );
  }
  return null;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function HeatmapCell({ value, maxValue }) {
  const intensity = maxValue > 0 ? value / maxValue : 0;
  const bg =
    intensity > 0.8
      ? 'bg-emerald-500'
      : intensity > 0.6
      ? 'bg-emerald-500/70'
      : intensity > 0.4
      ? 'bg-emerald-500/50'
      : intensity > 0.2
      ? 'bg-emerald-500/30'
      : intensity > 0
      ? 'bg-emerald-500/15'
      : 'bg-zinc-800/50';

  return (
    <div
      className={`w-full aspect-square rounded-sm ${bg} cursor-pointer transition-colors`}
      title={`${value} avg views`}
    />
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    globalStats,
    channels,
    pendingChannels,
    analysisData,
    fetchStats,
    fetchChannels,
    fetchAnalysis,
  } = useAppStore();

  const [trends, setTrends] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [growthData, setGrowthData] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchChannels();
    fetchAnalysis();

    // Fetch trends, heatmap, and growth data
    api.get('/stats/trends').then((r) => setTrends(r.data)).catch(() => {});
    api.get('/stats/heatmap').then((r) => setHeatmap(r.data)).catch(() => {});
    api.get('/stats/growth').then((r) => setGrowthData(r.data || [])).catch(() => {});
  }, [fetchStats, fetchChannels, fetchAnalysis]);

  // Top 5 channels by 7d growth (from live growth data, fallback to subscribers)
  const topGrowthChannels = [...growthData]
    .sort((a, b) => (b.growth_7d || 0) - (a.growth_7d || 0))
    .slice(0, 5);

  const topChannelsFallback = [...channels]
    .sort((a, b) => (b.subscribers_count || 0) - (a.subscribers_count || 0))
    .slice(0, 5)
    .map((ch) => ({
      name: ch.title?.length > 18 ? ch.title.substring(0, 18) + '...' : ch.title,
      subscribers: ch.subscribers_count || 0,
    }));

  const topMessages = [...analysisData]
    .sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))
    .slice(0, 5);

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const recentActivity = [
    ...channels.slice(0, 3).map((ch) => ({
      id: `approved-${ch.id}`,
      action: 'Channel tracked',
      detail: `${ch.title} is being monitored`,
      time: formatTimeAgo(ch.approved_at || ch.created_at),
      type: 'approved',
    })),
    ...pendingChannels.slice(0, 2).map((ch) => ({
      id: `pending-${ch.id}`,
      action: 'New channel discovered',
      detail: `${ch.title} via Telegram sync`,
      time: formatTimeAgo(ch.discovered_at || ch.created_at),
      type: 'discovery',
    })),
  ].slice(0, 5);

  // Build heatmap grid (7 days x 24 hours)
  const heatmapGrid = [];
  let heatmapMax = 0;
  if (heatmap?.heatmap) {
    const lookup = {};
    for (const cell of heatmap.heatmap) {
      lookup[`${cell.day}-${cell.hour}`] = cell.avg_views;
      if (cell.avg_views > heatmapMax) heatmapMax = cell.avg_views;
    }
    for (let day = 0; day < 7; day++) {
      const row = [];
      for (let hour = 0; hour < 24; hour++) {
        row.push(lookup[`${day}-${hour}`] || 0);
      }
      heatmapGrid.push(row);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Radio}
          label="Channels Tracked"
          value={globalStats.totalChannels}
          iconColor="text-emerald-500"
        />
        <StatCard
          icon={MessageSquare}
          label="Messages Collected"
          value={globalStats.totalMessages}
          iconColor="text-cyan-500"
        />
        <StatCard
          icon={Brain}
          label="Messages Analyzed"
          value={globalStats.totalAnalyzed}
          iconColor="text-purple-500"
        />
        <StatCard
          icon={MousePointerClick}
          label="Messages with CTA"
          value={globalStats.totalVoices}
          iconColor="text-amber-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Channels by Growth */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-zinc-100">
              Top Channels by Growth
            </h3>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          {topGrowthChannels.length > 0 ? (
            <div className="space-y-3">
              {topGrowthChannels.map((ch, idx) => {
                const sparkData = (ch.sparkline || []).map((v, i) => ({ i, v }));
                const formatSubs = (v) => {
                  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
                  return String(v);
                };
                const isPositive = (ch.growth_7d || 0) >= 0;
                return (
                  <div
                    key={ch.channel_id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/channels/${ch.channel_id}`)}
                  >
                    <span className="text-xs font-bold text-zinc-500 w-5">
                      {idx + 1}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-500 font-bold text-xs">
                        {(ch.title || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">
                        {ch.title}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatSubs(ch.subscribers_count)} subscribers
                      </p>
                    </div>
                    {/* Sparkline */}
                    {sparkData.length > 1 && (
                      <div className="w-20 h-8 flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={sparkData}>
                            <Line
                              type="monotone"
                              dataKey="v"
                              stroke={isPositive ? '#10b981' : '#ef4444'}
                              strokeWidth={1.5}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <div className="text-right flex-shrink-0 w-20">
                      <p className={`text-sm font-bold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{ch.growth_7d}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {isPositive ? '+' : ''}{ch.growth_7d_pct}% / 7d
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : topChannelsFallback.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topChannelsFallback} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#27272a"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  axisLine={{ stroke: '#27272a' }}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000000
                      ? `${(v / 1000000).toFixed(1)}M`
                      : v >= 1000
                      ? `${(v / 1000).toFixed(0)}K`
                      : v
                  }
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#a1a1aa', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={140}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="subscribers"
                  fill="#10b981"
                  radius={[0, 4, 4, 0]}
                  barSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-zinc-500">
              <p>No channel data yet</p>
            </div>
          )}
        </Card>

        {/* Top Messages by Engagement */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-zinc-100">
              Top Messages by Score
            </h3>
            <Eye className="w-5 h-5 text-cyan-500" />
          </div>
          {topMessages.length > 0 ? (
            <div className="space-y-3">
              {topMessages.map((msg, idx) => (
                <div
                  key={msg.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors cursor-pointer"
                  onClick={() => navigate('/analysis')}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                    <span className="text-xs font-bold text-zinc-300">
                      #{idx + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 line-clamp-2">
                      {msg.message_text}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant={msg.hook_type}>{msg.hook_type}</Badge>
                      <span className="text-xs text-zinc-500">
                        {msg.channel_title}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg font-bold text-emerald-500">
                      {(msg.engagement_score || 0).toFixed(1)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {(msg.views_count || 0).toLocaleString()} views
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-zinc-500">
              <p>No messages analyzed yet</p>
            </div>
          )}
        </Card>
      </div>

      {/* Trends & Heatmap Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trending Hooks */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-zinc-100">
              Trending Hooks
            </h3>
            <Flame className="w-5 h-5 text-orange-500" />
          </div>
          {trends?.top_hooks?.length > 0 ? (
            <div className="space-y-3">
              {trends.top_hooks.slice(0, 6).map((hook, i) => (
                <div key={hook.type} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-zinc-500 w-5">
                    {i + 1}
                  </span>
                  <Badge variant={hook.type}>{hook.type}</Badge>
                  <div className="flex-1">
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500/70 rounded-full"
                        style={{
                          width: `${Math.min(
                            (hook.count /
                              Math.max(
                                ...trends.top_hooks.map((h) => h.count)
                              )) *
                              100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-zinc-400 w-10 text-right">
                    {hook.count}
                  </span>
                  <span className="text-xs text-emerald-500 w-12 text-right">
                    {hook.avg_engagement}/10
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-zinc-500">
              <p>No trend data yet</p>
            </div>
          )}
        </Card>

        {/* Best Time to Post Heatmap */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-zinc-100">
              Best Time to Post
            </h3>
            <Zap className="w-5 h-5 text-yellow-500" />
          </div>
          {heatmap?.best_time && (
            <p className="text-sm text-zinc-400 mb-4">
              Best:{' '}
              <span className="text-emerald-400 font-medium">
                {heatmap.best_time.day} at {heatmap.best_time.hour}:00
              </span>{' '}
              ({Math.round(heatmap.best_time.avg_views).toLocaleString()} avg
              views)
            </p>
          )}
          {heatmapGrid.length > 0 ? (
            <div className="space-y-1">
              {/* Hour labels */}
              <div className="flex gap-0.5 ml-10">
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="flex-1 text-center text-[10px] text-zinc-600"
                  >
                    {h % 3 === 0 ? `${h}h` : ''}
                  </div>
                ))}
              </div>
              {/* Grid rows */}
              {heatmapGrid.map((row, dayIdx) => (
                <div key={dayIdx} className="flex items-center gap-0.5">
                  <span className="text-xs text-zinc-500 w-10 text-right pr-2">
                    {DAY_LABELS[dayIdx]}
                  </span>
                  {row.map((value, hourIdx) => (
                    <div key={hourIdx} className="flex-1">
                      <HeatmapCell value={value} maxValue={heatmapMax} />
                    </div>
                  ))}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center justify-end gap-1 mt-2">
                <span className="text-[10px] text-zinc-600">Less</span>
                <div className="w-3 h-3 rounded-sm bg-zinc-800/50" />
                <div className="w-3 h-3 rounded-sm bg-emerald-500/15" />
                <div className="w-3 h-3 rounded-sm bg-emerald-500/30" />
                <div className="w-3 h-3 rounded-sm bg-emerald-500/50" />
                <div className="w-3 h-3 rounded-sm bg-emerald-500/70" />
                <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                <span className="text-[10px] text-zinc-600">More</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-zinc-500">
              <p>No posting data yet</p>
            </div>
          )}
        </Card>
      </div>

      {/* Best Hours + Channel Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Posting Hours */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-zinc-100">
              Best Posting Hours
            </h3>
            <BarChart3 className="w-5 h-5 text-purple-500" />
          </div>
          {trends?.best_hours?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={trends.best_hours.map((h) => ({
                  hour: `${h.hour}:00`,
                  avgViews: Math.round(h.avg_views),
                  count: h.count,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  axisLine={{ stroke: '#27272a' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#a1a1aa' }}
                  itemStyle={{ color: '#a78bfa' }}
                />
                <Bar
                  dataKey="avgViews"
                  fill="#a78bfa"
                  radius={[4, 4, 0, 0]}
                  barSize={30}
                  name="Avg Views"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-zinc-500">
              <p>No posting data yet</p>
            </div>
          )}
        </Card>

        {/* Channel Activity Summary */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-zinc-100">
              Channel Activity
            </h3>
            <Radio className="w-5 h-5 text-cyan-500" />
          </div>
          {trends?.channel_summaries?.length > 0 ? (
            <div className="space-y-3">
              {trends.channel_summaries.slice(0, 6).map((ch) => (
                <div
                  key={ch.channel_id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/channels/${ch.channel_id}`)}
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-500 font-bold text-xs">
                      {(ch.title || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {ch.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {ch.total_messages} msgs
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-cyan-400">
                      {Math.round(ch.avg_views).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-zinc-500">avg views</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-zinc-500">
              <p>No channel data yet</p>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-zinc-100">
            Recent Activity
          </h3>
          <Clock className="w-5 h-5 text-zinc-500" />
        </div>
        {recentActivity.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-zinc-500">
            <p>No recent activity yet. Sync Telegram channels to get started.</p>
          </div>
        ) : (
        <div className="space-y-4">
          {recentActivity.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-4 py-2"
            >
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  activity.type === 'discovery'
                    ? 'bg-cyan-500'
                    : activity.type === 'analysis'
                    ? 'bg-purple-500'
                    : activity.type === 'approved'
                    ? 'bg-emerald-500'
                    : activity.type === 'voice'
                    ? 'bg-amber-500'
                    : 'bg-pink-500'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200">
                  {activity.action}
                </p>
                <p className="text-xs text-zinc-500">{activity.detail}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-zinc-500 flex-shrink-0">
                <Clock className="w-3 h-3" />
                <span>{activity.time}</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
            </div>
          ))}
        </div>
        )}
      </Card>
    </div>
  );
}
