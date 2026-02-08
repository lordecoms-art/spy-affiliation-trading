import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  TrendingUp,
  MessageSquare,
  BarChart3,
  Loader2,
  UserCircle,
  Smartphone,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import Card from '../components/Card';
import Badge from '../components/Badge';
import useAppStore from '../stores/appStore';
import api from '../utils/api';

const ChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl">
        <p className="text-xs text-zinc-400">{label}</p>
        <p className="text-sm font-medium text-emerald-400">
          {payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export default function ChannelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    selectedChannel,
    channelStats,
    channelsLoading,
    fetchChannelDetail,
    fetchChannelStats,
  } = useAppStore();

  const [statsHistory, setStatsHistory] = useState([]);
  const [growth, setGrowth] = useState(null);

  useEffect(() => {
    fetchChannelDetail(id);
    fetchChannelStats(id);
    // Fetch real stats history for chart
    api.get(`/stats/channel/${id}`, { params: { limit: 90 } })
      .then((r) => {
        const data = (r.data || [])
          .reverse()
          .map((s) => ({
            date: new Date(s.recorded_at).toLocaleDateString([], { day: 'numeric', month: 'short' }),
            count: s.subscribers_count,
          }));
        setStatsHistory(data);
      })
      .catch(() => {});
    // Fetch growth data for this channel
    api.get('/stats/growth')
      .then((r) => {
        const all = r.data || [];
        const mine = all.find((g) => String(g.channel_id) === String(id));
        if (mine) setGrowth(mine);
      })
      .catch(() => {});
  }, [id, fetchChannelDetail, fetchChannelStats]);

  if (channelsLoading || !selectedChannel) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const channel = selectedChannel;
  const subscriberHistory =
    statsHistory.length > 0
      ? statsHistory
      : channel.subscriber_history || channelStats?.subscriber_history || [];
  const recentMessages = channel.recent_messages || [];
  const patterns = channel.patterns || { hook_types: [], cta_types: [] };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/channels')}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Channels</span>
      </button>

      {/* Channel Header */}
      <Card>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {channel.photo_url ? (
              <img
                src={channel.photo_url}
                alt={channel.title}
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-500 font-bold text-xl">
                  {(channel.title || '?')[0].toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-zinc-100">
                {channel.title}
              </h2>
              <p className="text-emerald-500 text-sm mt-1">
                {channel.username ? `@${channel.username}` : ''}
              </p>
              <p className="text-zinc-400 text-sm mt-3 max-w-2xl">
                {channel.description || 'No description available'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/channels/${id}/preview`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Smartphone className="w-4 h-4" />
              Preview Feed
            </button>
            <button
              onClick={() => navigate(`/channels/${id}/persona`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <UserCircle className="w-4 h-4" />
              View Persona
            </button>
            <Badge variant={channel.status || 'approved'}>
              {channel.status || 'approved'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-800">
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-zinc-100">
                {(channel.subscribers_count || 0).toLocaleString()}
              </p>
              <p className="text-xs text-zinc-500">Subscribers</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-800">
              <TrendingUp className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-zinc-100">
                {channel.growth_7d >= 0 ? '+' : ''}
                {channel.growth_7d || 0}%
              </p>
              <p className="text-xs text-zinc-500">Growth 7d</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-800">
              <MessageSquare className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-zinc-100">
                {channel.messages_per_day || 0}
              </p>
              <p className="text-xs text-zinc-500">Msgs/Day</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-800">
              <BarChart3 className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-zinc-100">
                {(channel.avg_engagement || 0).toFixed(1)}
              </p>
              <p className="text-xs text-zinc-500">Avg Engagement</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Growth Summary Cards */}
      {growth && growth.snapshots_count >= 2 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '+/- 24h', abs: growth.growth_24h, pct: growth.growth_24h_pct },
            { label: '+/- 7 days', abs: growth.growth_7d, pct: growth.growth_7d_pct },
            { label: '+/- 30 days', abs: growth.growth_30d, pct: growth.growth_30d_pct },
          ].map((g) => {
            const isPos = g.abs >= 0;
            return (
              <Card key={g.label}>
                <p className="text-xs text-zinc-500 mb-1">{g.label}</p>
                <p className={`text-2xl font-bold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPos ? '+' : ''}{g.abs}
                </p>
                <p className={`text-sm ${isPos ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                  {isPos ? '+' : ''}{g.pct}%
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscriber Evolution */}
        <Card>
          <h3 className="text-lg font-semibold text-zinc-100 mb-6">
            Subscriber Evolution
          </h3>
          {subscriberHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={subscriberHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="date"
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
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-zinc-500">
              No subscriber history available
            </div>
          )}
        </Card>

        {/* Detected Patterns */}
        <Card>
          <h3 className="text-lg font-semibold text-zinc-100 mb-6">
            Detected Patterns
          </h3>

          <div className="space-y-6">
            {/* Hook Types */}
            <div>
              <h4 className="text-sm font-medium text-zinc-400 mb-3">
                Hook Types
              </h4>
              {patterns.hook_types.length > 0 ? (
                <div className="space-y-2">
                  {patterns.hook_types.map((hook) => (
                    <div
                      key={hook.type}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={hook.type}>{hook.type}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{
                              width: `${Math.min(
                                (hook.count /
                                  Math.max(
                                    ...patterns.hook_types.map((h) => h.count)
                                  )) *
                                  100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm text-zinc-400 w-8 text-right">
                          {hook.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No patterns detected yet</p>
              )}
            </div>

            {/* CTA Types */}
            <div>
              <h4 className="text-sm font-medium text-zinc-400 mb-3">
                CTA Types
              </h4>
              {patterns.cta_types.length > 0 ? (
                <div className="space-y-2">
                  {patterns.cta_types.map((cta) => (
                    <div
                      key={cta.type}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={cta.type}>{cta.type}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-500 rounded-full"
                            style={{
                              width: `${Math.min(
                                (cta.count /
                                  Math.max(
                                    ...patterns.cta_types.map((c) => c.count)
                                  )) *
                                  100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm text-zinc-400 w-8 text-right">
                          {cta.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No CTAs detected yet</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Messages */}
      <Card>
        <h3 className="text-lg font-semibold text-zinc-100 mb-6">
          Recent Messages
        </h3>
        {recentMessages.length > 0 ? (
          <div className="space-y-3">
            {recentMessages.map((msg) => (
              <div
                key={msg.id}
                className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-800"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={msg.hook_type}>{msg.hook_type}</Badge>
                    <Badge variant={msg.cta_type}>{msg.cta_type}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-emerald-500 font-medium">
                      Score: {msg.score}
                    </span>
                    <span className="text-zinc-500">
                      {(msg.views || 0).toLocaleString()} views
                    </span>
                  </div>
                </div>
                <p className="text-sm text-zinc-300">{msg.text}</p>
                <p className="text-xs text-zinc-500 mt-2">
                  {new Date(msg.date).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-500">
            No recent messages available
          </div>
        )}
      </Card>
    </div>
  );
}
