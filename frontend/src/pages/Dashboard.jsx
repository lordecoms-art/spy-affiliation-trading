import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio,
  MessageSquare,
  Brain,
  Mic,
  TrendingUp,
  Eye,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
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

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    globalStats,
    channels,
    pendingChannels,
    messages,
    fetchStats,
    fetchChannels,
    fetchMessages,
  } = useAppStore();

  useEffect(() => {
    fetchStats();
    fetchChannels();
    fetchMessages();
  }, [fetchStats, fetchChannels, fetchMessages]);

  const topChannels = [...channels]
    .sort((a, b) => (b.growth_7d || 0) - (a.growth_7d || 0))
    .slice(0, 5)
    .map((ch) => ({
      name: ch.title?.length > 18 ? ch.title.substring(0, 18) + '...' : ch.title,
      growth: ch.growth_7d || 0,
      subscribers: ch.subscribers_count || 0,
    }));

  const topMessages = [...messages]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
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

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Radio}
          label="Channels Tracked"
          value={globalStats.totalChannels}
          change={globalStats.channelGrowth}
          iconColor="text-emerald-500"
        />
        <StatCard
          icon={MessageSquare}
          label="Messages Collected"
          value={globalStats.totalMessages}
          change={globalStats.messageGrowth}
          iconColor="text-cyan-500"
        />
        <StatCard
          icon={Brain}
          label="Messages Analyzed"
          value={globalStats.totalAnalyzed}
          change={globalStats.analyzedGrowth}
          iconColor="text-purple-500"
        />
        <StatCard
          icon={Mic}
          label="Voices Transcribed"
          value={globalStats.totalVoices}
          change={globalStats.voiceGrowth}
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
          {topChannels.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topChannels} layout="vertical">
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
                  unit="%"
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
                  dataKey="growth"
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
                      {msg.text}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant={msg.hook_type}>{msg.hook_type}</Badge>
                      <span className="text-xs text-zinc-500">
                        {msg.channel_name}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg font-bold text-emerald-500">
                      {msg.score}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {(msg.views || 0).toLocaleString()} views
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
