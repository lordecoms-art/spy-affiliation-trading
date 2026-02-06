import { Fragment, useEffect, useState } from 'react';
import {
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  Forward,
  MessageSquare,
} from 'lucide-react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import useAppStore from '../stores/appStore';

export default function MessagesAnalysis() {
  const {
    analysisData,
    channels,
    analysisLoading,
    fetchAnalysis,
    fetchChannels,
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
      if (value) activeFilters[key] = value;
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
    if (filters.min_score && (msg.score || 0) < Number(filters.min_score))
      return false;
    return true;
  });

  const hookTypes = [
    'urgency',
    'social_proof',
    'authority',
    'scarcity',
    'reciprocity',
  ];

  return (
    <div className="space-y-6">
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
                  {type.replace('_', ' ')}
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
              Adjust your filters or wait for new messages to be analyzed.
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
                      {msg.channel_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300 max-w-xs">
                      <p className="line-clamp-1">{msg.text}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={msg.hook_type}>
                        {(msg.hook_type || '').replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={msg.cta_type}>
                        {(msg.cta_type || '').replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-bold ${
                          (msg.score || 0) >= 8
                            ? 'text-emerald-500'
                            : (msg.score || 0) >= 6
                            ? 'text-yellow-500'
                            : 'text-zinc-400'
                        }`}
                      >
                        {msg.score || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {(msg.views || 0).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Forward className="w-3.5 h-3.5" />
                          {(msg.forwards || 0).toLocaleString()}
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
                            <p className="text-sm text-zinc-300 bg-zinc-800 rounded-lg p-3">
                              {msg.text}
                            </p>
                          </div>

                          {/* Analysis breakdown */}
                          {msg.analysis && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2">
                                  Hook Analysis
                                </h4>
                                <p className="text-sm text-zinc-400">
                                  {msg.analysis.hook}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2">
                                  CTA Analysis
                                </h4>
                                <p className="text-sm text-zinc-400">
                                  {msg.analysis.cta}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2">
                                  Persuasion Techniques
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {(
                                    msg.analysis.persuasion_techniques || []
                                  ).map((tech) => (
                                    <Badge key={tech} variant="info">
                                      {tech}
                                    </Badge>
                                  ))}
                                </div>
                                {msg.analysis.estimated_conversion && (
                                  <p className="text-sm text-emerald-500 mt-2">
                                    Est. conversion:{' '}
                                    {msg.analysis.estimated_conversion}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Date */}
                          <p className="text-xs text-zinc-500">
                            Posted:{' '}
                            {msg.date
                              ? new Date(msg.date).toLocaleString()
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
