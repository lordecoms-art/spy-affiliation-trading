import { Fragment, useEffect, useState } from 'react';
import {
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  Forward,
  MessageSquare,
  Download,
  Brain,
  Loader2,
} from 'lucide-react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import useAppStore from '../stores/appStore';

export default function MessagesAnalysis() {
  const {
    analysisData,
    channels,
    analysisLoading,
    scrapingAll,
    analyzingAll,
    scrapeProgress,
    fetchAnalysis,
    fetchChannels,
    scrapeAllMessages,
    runAnalysis,
  } = useAppStore();

  const [filters, setFilters] = useState({
    channel_id: '',
    hook_type: '',
    min_score: '',
    start_date: '',
    end_date: '',
  });
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    fetchChannels();
    fetchAnalysis();
  }, [fetchChannels, fetchAnalysis]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    const activeFilters = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        if (key === 'min_score') {
          activeFilters['min_engagement'] = value;
        } else {
          activeFilters[key] = value;
        }
      }
    });
    fetchAnalysis(activeFilters);
  };

  const filteredData = analysisData.filter((msg) => {
    if (
      filters.channel_id &&
      String(msg.channel_id) !== String(filters.channel_id)
    )
      return false;
    if (filters.hook_type && msg.hook_type !== filters.hook_type) return false;
    if (filters.min_score && (msg.engagement_score || 0) < Number(filters.min_score))
      return false;
    return true;
  });

  const hookTypes = [
    'question',
    'bold_claim',
    'statistic',
    'story',
    'urgency',
    'fear',
    'curiosity',
    'social_proof',
    'authority',
    'pain_point',
  ];

  const handleScrape = async () => {
    try {
      await scrapeAllMessages();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAnalyze = async () => {
    try {
      await runAnalysis();
      fetchAnalysis();
    } catch (e) {
      console.error(e);
    }
  };

  const parseSafeJson = (str) => {
    if (!str) return [];
    try {
      return JSON.parse(str);
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleScrape}
          disabled={scrapingAll}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-500/50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {scrapingAll ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{scrapingAll ? 'Scraping...' : 'Scrape All Messages'}</span>
        </button>
        <button
          onClick={handleAnalyze}
          disabled={analyzingAll}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {analyzingAll ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Brain className="w-4 h-4" />
          )}
          <span>{analyzingAll ? 'Analyzing...' : 'Run AI Analysis'}</span>
        </button>
      </div>

      {/* Scrape Progress */}
      {scrapeProgress && scrapeProgress.status === 'in_progress' && (
        <Card>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-300">
                Scraping in progress...
              </h3>
              <span className="text-xs text-zinc-500">
                {scrapeProgress.channels_done}/{scrapeProgress.channels_total} channels
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                style={{
                  width: `${scrapeProgress.channels_total > 0
                    ? (scrapeProgress.channels_done / scrapeProgress.channels_total) * 100
                    : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span>Current: {scrapeProgress.current_channel || '...'}</span>
              <span>{scrapeProgress.total_new} new messages</span>
              <span>{scrapeProgress.total_scraped} total scraped</span>
            </div>
            {scrapeProgress.auto_analysis?.status === 'in_progress' && (
              <div className="flex items-center gap-2 text-xs text-purple-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>
                  Auto-analyzing: {scrapeProgress.auto_analysis.analyzed}/
                  {scrapeProgress.auto_analysis.total_queued} messages
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-medium text-zinc-300">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">
              Channel
            </label>
            <select
              value={filters.channel_id}
              onChange={(e) =>
                handleFilterChange('channel_id', e.target.value)
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:border-emerald-500/50"
            >
              <option value="">All Channels</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">
              Hook Type
            </label>
            <select
              value={filters.hook_type}
              onChange={(e) =>
                handleFilterChange('hook_type', e.target.value)
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:border-emerald-500/50"
            >
              <option value="">All Types</option>
              {hookTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">
              Min Score
            </label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.5"
              value={filters.min_score}
              onChange={(e) =>
                handleFilterChange('min_score', e.target.value)
              }
              placeholder="0"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) =>
                handleFilterChange('start_date', e.target.value)
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">
              End Date
            </label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) =>
                handleFilterChange('end_date', e.target.value)
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:border-emerald-500/50"
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={applyFilters}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {filteredData.length} messages found
        </p>
      </div>

      {/* Messages Table */}
      {analysisLoading ? (
        <Card>
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </Card>
      ) : filteredData.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <MessageSquare className="w-12 h-12 mb-4 text-zinc-600" />
            <p className="text-lg font-medium text-zinc-400 mb-1">
              No analyzed messages found
            </p>
            <p className="text-sm">
              Click "Scrape Messages" then "Run AI Analysis" to get started.
            </p>
          </div>
        </Card>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Channel
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Hook
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  CTA
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Views
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredData.map((msg) => (
                <Fragment key={msg.id}>
                  <tr
                    className="hover:bg-zinc-800/30 cursor-pointer transition-colors"
                    onClick={() =>
                      setExpandedRow(
                        expandedRow === msg.id ? null : msg.id
                      )
                    }
                  >
                    <td className="px-4 py-3 text-sm text-zinc-300 whitespace-nowrap">
                      {msg.channel_title || `Ch #${msg.channel_id}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300 max-w-xs">
                      <p className="line-clamp-1">{msg.message_text}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={msg.hook_type}>
                        {(msg.hook_type || '').replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={msg.cta_type}>
                        {(msg.cta_type || '').replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-bold ${
                          (msg.engagement_score || 0) >= 8
                            ? 'text-emerald-500'
                            : (msg.engagement_score || 0) >= 6
                            ? 'text-yellow-500'
                            : 'text-zinc-400'
                        }`}
                      >
                        {msg.engagement_score
                          ? msg.engagement_score.toFixed(1)
                          : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {(msg.views_count || 0).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Forward className="w-3.5 h-3.5" />
                          {(msg.forwards_count || 0).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {expandedRow === msg.id ? (
                        <ChevronUp className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      )}
                    </td>
                  </tr>
                  {expandedRow === msg.id && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-4 bg-zinc-800/30"
                      >
                        <div className="space-y-4">
                          {/* Full message */}
                          <div>
                            <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2">
                              Full Message
                            </h4>
                            <p className="text-sm text-zinc-300 bg-zinc-800 rounded-lg p-3 whitespace-pre-wrap">
                              {msg.message_text}
                            </p>
                          </div>

                          {/* Analysis breakdown */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2">
                                Tone
                              </h4>
                              <Badge variant={msg.tone}>
                                {(msg.tone || 'unknown').replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <div>
                              <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2">
                                Virality Potential
                              </h4>
                              <span className="text-sm font-bold text-purple-400">
                                {msg.virality_potential
                                  ? msg.virality_potential.toFixed(1)
                                  : '-'}
                                /10
                              </span>
                            </div>
                            <div>
                              <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2">
                                Promises / Social Proof
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                {parseSafeJson(msg.promises).map((p, i) => (
                                  <Badge key={i} variant="info">
                                    {p}
                                  </Badge>
                                ))}
                                {parseSafeJson(msg.social_proof_elements).map(
                                  (s, i) => (
                                    <Badge key={`sp-${i}`} variant="pending">
                                      {s}
                                    </Badge>
                                  )
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Date */}
                          <p className="text-xs text-zinc-500">
                            Analyzed:{' '}
                            {msg.analyzed_at
                              ? new Date(msg.analyzed_at).toLocaleString()
                              : 'Unknown'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
