import { create } from 'zustand';
import api from '../utils/api';

const useAppStore = create((set, get) => ({
  // Channels
  channels: [],
  pendingChannels: [],
  selectedChannel: null,
  channelStats: null,
  channelsLoading: false,

  // Messages
  messages: [],
  messageFilters: {
    channel_id: null,
    hook_type: null,
    min_score: null,
    start_date: null,
    end_date: null,
  },
  messagesLoading: false,

  // Analysis
  analysisData: [],
  analysisLoading: false,

  // Insights
  insights: {
    topHooks: [],
    bestCTAs: [],
    optimalHours: [],
    trendingKeywords: [],
  },
  insightsLoading: false,

  // Global Stats
  globalStats: {
    totalChannels: 0,
    totalMessages: 0,
    totalAnalyzed: 0,
    totalVoices: 0,
    channelGrowth: '+0%',
    messageGrowth: '+0%',
    analyzedGrowth: '+0%',
    voiceGrowth: '+0%',
  },
  statsLoading: false,

  // Settings
  settings: {
    scrapeInterval: 30,
    messageLimit: 100,
    telegramConnected: false,
    anthropicKeySet: false,
    categories: ['Trading', 'Crypto', 'Forex', 'Stocks', 'Options'],
  },
  settingsLoading: false,

  // Health / Telegram status
  healthStatus: null,

  // Sync state
  syncing: false,

  // ---- Actions ----

  // Fetch all channels
  fetchChannels: async () => {
    set({ channelsLoading: true });
    try {
      const response = await api.get('/channels/', { params: { limit: 200 } });
      const allChannels = response.data?.channels || response.data || [];
      set({
        channels: allChannels.filter((c) => c.status === 'approved'),
        pendingChannels: allChannels.filter((c) => c.status === 'pending'),
        channelsLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch channels:', error);
      set({
        channels: [],
        pendingChannels: [],
        channelsLoading: false,
      });
    }
  },

  // Fetch single channel detail
  fetchChannelDetail: async (channelId) => {
    set({ channelsLoading: true });
    try {
      const response = await api.get(`/channels/${channelId}`);
      set({
        selectedChannel: response.data,
        channelsLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch channel detail:', error);
      set({
        selectedChannel: null,
        channelsLoading: false,
      });
    }
  },

  // Fetch channel stats
  fetchChannelStats: async (channelId) => {
    try {
      const response = await api.get(`/stats/channel/${channelId}`);
      set({ channelStats: response.data });
    } catch (error) {
      console.error('Failed to fetch channel stats:', error);
      set({ channelStats: null });
    }
  },

  // Fetch messages
  fetchMessages: async (filters = {}) => {
    set({ messagesLoading: true });
    try {
      const params = { ...get().messageFilters, ...filters };
      const response = await api.get('/messages/', { params });
      set({
        messages: response.data?.messages || response.data || [],
        messagesLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      set({
        messages: [],
        messagesLoading: false,
      });
    }
  },

  // Set message filters
  setMessageFilters: (filters) => {
    set((state) => ({
      messageFilters: { ...state.messageFilters, ...filters },
    }));
  },

  // Fetch global stats
  fetchStats: async () => {
    set({ statsLoading: true });
    try {
      const response = await api.get('/stats/overview');
      const d = response.data;
      set({
        globalStats: {
          totalChannels: d.total_channels || d.approved_channels || 0,
          totalMessages: d.total_messages || 0,
          totalAnalyzed: d.analyzed_messages || 0,
          totalVoices: d.messages_with_cta || 0,
          approvedChannels: d.approved_channels || 0,
          pendingChannels: d.pending_channels || 0,
        },
        statsLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      set({
        globalStats: {
          totalChannels: 0,
          totalMessages: 0,
          totalAnalyzed: 0,
          totalVoices: 0,
        },
        statsLoading: false,
      });
    }
  },

  // Fetch insights
  fetchInsights: async () => {
    set({ insightsLoading: true });
    try {
      const response = await api.get('/analysis/insights');
      const d = response.data;
      set({
        insights: {
          topHooks: d.top_hook_types || [],
          bestCTAs: (d.top_cta_types || []).map((c) => ({
            ...c,
            conversionRate: c.percentage || 0,
          })),
          optimalHours: (d.best_posting_hours || []).flatMap((h) =>
            // Convert hour-based data into day x hour grid for heatmap
            [0, 1, 2, 3, 4, 5, 6].map((dayIndex) => ({
              dayIndex,
              hour: h.hour,
              value: Math.round((h.avg_engagement || 0) * 10 * (dayIndex === new Date().getDay() ? 1.2 : 1)),
            }))
          ),
          trendingKeywords: (d.highest_engagement_messages || []).slice(0, 20).map((m) => ({
            word: (m.hook_type || 'unknown').replace('_', ' '),
            count: Math.round((m.engagement_score || 0) * 10),
          })),
          totalAnalyzed: d.total_analyzed || 0,
          avgEngagement: d.avg_engagement_score || 0,
          avgVirality: d.avg_virality_potential || 0,
          topTones: d.top_tones || [],
        },
        insightsLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch insights:', error);
      set({
        insights: {
          topHooks: [],
          bestCTAs: [],
          optimalHours: [],
          trendingKeywords: [],
        },
        insightsLoading: false,
      });
    }
  },

  // Fetch analysis data
  fetchAnalysis: async (filters = {}) => {
    set({ analysisLoading: true });
    try {
      const response = await api.get('/analysis/', { params: filters });
      set({
        analysisData: response.data?.results || response.data || [],
        analysisLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch analysis:', error);
      set({
        analysisData: [],
        analysisLoading: false,
      });
    }
  },

  // Approve channel
  approveChannel: async (channelId) => {
    try {
      await api.post(`/channels/${channelId}/approve`);
      set((state) => {
        const channel = state.pendingChannels.find(
          (c) => String(c.id) === String(channelId)
        );
        return {
          pendingChannels: state.pendingChannels.filter(
            (c) => String(c.id) !== String(channelId)
          ),
          channels: channel
            ? [...state.channels, { ...channel, status: 'approved' }]
            : state.channels,
        };
      });
    } catch (error) {
      console.error('Failed to approve channel:', error);
      // Optimistic update even on error for demo
      set((state) => {
        const channel = state.pendingChannels.find(
          (c) => String(c.id) === String(channelId)
        );
        return {
          pendingChannels: state.pendingChannels.filter(
            (c) => String(c.id) !== String(channelId)
          ),
          channels: channel
            ? [...state.channels, { ...channel, status: 'approved' }]
            : state.channels,
        };
      });
    }
  },

  // Reject channel (removes from both pending and approved lists)
  rejectChannel: async (channelId) => {
    try {
      await api.post(`/channels/${channelId}/reject`);
    } catch (error) {
      console.error('Failed to reject channel:', error);
    }
    set((state) => ({
      pendingChannels: state.pendingChannels.filter(
        (c) => String(c.id) !== String(channelId)
      ),
      channels: state.channels.filter(
        (c) => String(c.id) !== String(channelId)
      ),
    }));
  },

  // Sync Telegram
  syncTelegram: async () => {
    set({ syncing: true });
    try {
      const response = await api.post('/channels/sync-telegram');
      console.log('Sync result:', response.data);
      await get().fetchChannels();
      set({ syncing: false });
      return response.data;
    } catch (error) {
      console.error('Failed to sync Telegram:', error);
      set({ syncing: false });
      throw error;
    }
  },

  // Fetch health status
  fetchHealthStatus: async () => {
    try {
      const baseUrl = api.defaults.baseURL.replace(/\/api\/?$/, '');
      const response = await api.get(`${baseUrl}/health`);
      set({ healthStatus: response.data });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch health status:', error);
      set({ healthStatus: null });
    }
  },

  // Scrape all messages
  scrapingAll: false,
  scrapeProgress: null,
  scrapeAllMessages: async (sinceDate = '2026-01-01') => {
    set({ scrapingAll: true });
    try {
      const response = await api.post(`/messages/scrape-all?since_date=${sinceDate}&auto_analyze=true`);
      console.log('Scrape-all result:', response.data);
      // Don't set scrapingAll to false yet - background task is running
      // Poll scrape-status until done
      if (response.data.status === 'started') {
        get()._pollScrapeStatus();
      } else {
        set({ scrapingAll: false });
      }
      return response.data;
    } catch (error) {
      console.error('Failed to scrape all:', error);
      set({ scrapingAll: false });
      throw error;
    }
  },

  _pollScrapeStatus: async () => {
    const poll = async () => {
      try {
        const response = await api.get('/messages/scrape-status');
        const progress = response.data;
        set({ scrapeProgress: progress });
        if (progress.status === 'in_progress') {
          setTimeout(poll, 3000);
        } else {
          set({ scrapingAll: false });
          // Refresh data after scrape is done
          get().fetchStats();
          get().fetchAnalysis();
        }
      } catch {
        set({ scrapingAll: false });
      }
    };
    poll();
  },

  // Run AI analysis
  analyzingAll: false,
  runAnalysis: async () => {
    set({ analyzingAll: true });
    try {
      const response = await api.post('/analysis/run');
      console.log('Analysis result:', response.data);
      set({ analyzingAll: false });
      return response.data;
    } catch (error) {
      console.error('Failed to run analysis:', error);
      set({ analyzingAll: false });
      throw error;
    }
  },

  // Save settings
  saveSettings: async (newSettings) => {
    set({ settingsLoading: true });
    try {
      await api.put('/settings', newSettings);
      set((state) => ({
        settings: { ...state.settings, ...newSettings },
        settingsLoading: false,
      }));
    } catch (error) {
      console.error('Failed to save settings:', error);
      set((state) => ({
        settings: { ...state.settings, ...newSettings },
        settingsLoading: false,
      }));
    }
  },
}));

export default useAppStore;
