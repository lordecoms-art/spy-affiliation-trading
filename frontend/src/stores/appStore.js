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
      const response = await api.get('/channels/');
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
      set({
        globalStats: response.data,
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
          channelGrowth: '+0%',
          messageGrowth: '+0%',
          analyzedGrowth: '+0%',
          voiceGrowth: '+0%',
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
      set({
        insights: response.data,
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

  // Reject channel
  rejectChannel: async (channelId) => {
    try {
      await api.post(`/channels/${channelId}/reject`);
      set((state) => ({
        pendingChannels: state.pendingChannels.filter(
          (c) => String(c.id) !== String(channelId)
        ),
      }));
    } catch (error) {
      console.error('Failed to reject channel:', error);
      set((state) => ({
        pendingChannels: state.pendingChannels.filter(
          (c) => String(c.id) !== String(channelId)
        ),
      }));
    }
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
