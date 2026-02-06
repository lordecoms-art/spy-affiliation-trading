import { useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Lightbulb,
  TrendingUp,
  MousePointerClick,
  Clock,
  Hash,
} from 'lucide-react';
import Card from '../components/Card';
import useAppStore from '../stores/appStore';

const ChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl">
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Insights() {
  const { insights, insightsLoading, fetchInsights } = useAppStore();

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const { topHooks, bestCTAs, optimalHours, trendingKeywords } = insights;

  // Build heatmap grid
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getHeatmapValue = (dayIndex, hour) => {
    const item = (optimalHours || []).find(
      (h) => h.dayIndex === dayIndex && h.hour === hour
    );
    return item ? item.value : 0;
  };

  const getHeatmapColor = (value) => {
    if (value >= 80) return 'bg-emerald-500';
    if (value >= 60) return 'bg-emerald-600';
    if (value >= 40) return 'bg-emerald-700';
    if (value >= 20) return 'bg-emerald-800';
    if (value >= 10) return 'bg-emerald-900';
    return 'bg-zinc-800';
  };

  const getHeatmapOpacity = (value) => {
    if (value >= 80) return 'opacity-100';
    if (value >= 60) return 'opacity-90';
    if (value >= 40) return 'opacity-75';
    if (value >= 20) return 'opacity-60';
    if (value >= 10) return 'opacity-40';
    return 'opacity-30';
  };

  if (insightsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxKeywordCount = Math.max(
    ...(trendingKeywords || []).map((k) => k.count),
    1
  );

  return (
    <div className="space-y-6">
      {/* Top Performing Hooks & Best CTAs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Hooks */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-zinc-100">
              Top Performing Hooks
            </h3>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          {topHooks && topHooks.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topHooks} layout="vertical">
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
                />
                <YAxis
                  type="category"
                  dataKey="type"
                  tick={{ fill: '#a1a1aa', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="count"
                  name="Usage Count"
                  fill="#10b981"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-zinc-500">
              No hook data available
            </div>
          )}
        </Card>

        {/* Best CTAs */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-zinc-100">Best CTAs</h3>
            <MousePointerClick className="w-5 h-5 text-cyan-500" />
          </div>
          {bestCTAs && bestCTAs.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bestCTAs} layout="vertical">
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
                />
                <YAxis
                  type="category"
                  dataKey="type"
                  tick={{ fill: '#a1a1aa', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="conversionRate"
                  name="Conversion Rate %"
                  fill="#06b6d4"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-zinc-500">
              No CTA data available
            </div>
          )}
        </Card>
      </div>

      {/* Optimal Posting Hours Heatmap */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-zinc-100">
            Optimal Posting Hours
          </h3>
          <Clock className="w-5 h-5 text-purple-500" />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Hour headers */}
            <div className="flex items-center mb-2">
              <div className="w-12 flex-shrink-0" />
              {hours.map((h) => (
                <div
                  key={h}
                  className="flex-1 text-center text-xs text-zinc-600"
                >
                  {h % 3 === 0 ? `${h}h` : ''}
                </div>
              ))}
            </div>
            {/* Heatmap rows */}
            {days.map((day, dayIndex) => (
              <div key={day} className="flex items-center mb-1">
                <div className="w-12 flex-shrink-0 text-xs text-zinc-400 font-medium">
                  {day}
                </div>
                <div className="flex-1 flex gap-0.5">
                  {hours.map((hour) => {
                    const value = getHeatmapValue(dayIndex, hour);
                    return (
                      <div
                        key={hour}
                        className={`flex-1 h-7 rounded-sm ${getHeatmapColor(
                          value
                        )} ${getHeatmapOpacity(value)} cursor-pointer`}
                        title={`${day} ${hour}:00 - Activity: ${value}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4">
              <span className="text-xs text-zinc-500">Less</span>
              <div className="w-5 h-3 bg-zinc-800 rounded-sm opacity-30" />
              <div className="w-5 h-3 bg-emerald-900 rounded-sm opacity-40" />
              <div className="w-5 h-3 bg-emerald-800 rounded-sm opacity-60" />
              <div className="w-5 h-3 bg-emerald-700 rounded-sm opacity-75" />
              <div className="w-5 h-3 bg-emerald-600 rounded-sm opacity-90" />
              <div className="w-5 h-3 bg-emerald-500 rounded-sm" />
              <span className="text-xs text-zinc-500">More</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Trending Keywords */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-zinc-100">
            Trending Keywords
          </h3>
          <Hash className="w-5 h-5 text-amber-500" />
        </div>
        {trendingKeywords && trendingKeywords.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {trendingKeywords.map((keyword) => {
              const ratio = keyword.count / maxKeywordCount;
              let sizeClass, fontWeight;
              if (ratio > 0.8) {
                sizeClass = 'text-2xl';
                fontWeight = 'font-bold';
              } else if (ratio > 0.6) {
                sizeClass = 'text-xl';
                fontWeight = 'font-semibold';
              } else if (ratio > 0.4) {
                sizeClass = 'text-lg';
                fontWeight = 'font-medium';
              } else if (ratio > 0.2) {
                sizeClass = 'text-base';
                fontWeight = 'font-normal';
              } else {
                sizeClass = 'text-sm';
                fontWeight = 'font-normal';
              }
              return (
                <div
                  key={keyword.word}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 transition-colors cursor-pointer group`}
                >
                  <span
                    className={`${sizeClass} ${fontWeight} text-zinc-300 group-hover:text-emerald-400 transition-colors`}
                  >
                    {keyword.word}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {keyword.count}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-zinc-500">
            No keyword data available
          </div>
        )}
      </Card>
    </div>
  );
}
