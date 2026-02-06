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

  // Sync state
  syncing: false,

  // ---- Actions ----

  // Fetch all channels
  fetchChannels: async () => {
    set({ channelsLoading: true });
    try {
      const response = await api.get('/channels');
      const allChannels = response.data?.channels || response.data || [];
      set({
        channels: allChannels.filter((c) => c.status === 'approved'),
        pendingChannels: allChannels.filter((c) => c.status === 'pending'),
        channelsLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch channels:', error);
      // Use mock data on failure
      set({
        channels: getMockApprovedChannels(),
        pendingChannels: getMockPendingChannels(),
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
      const mockChannel = getMockApprovedChannels().find(
        (c) => String(c.id) === String(channelId)
      );
      set({
        selectedChannel: mockChannel || getMockChannelDetail(channelId),
        channelsLoading: false,
      });
    }
  },

  // Fetch channel stats
  fetchChannelStats: async (channelId) => {
    try {
      const response = await api.get(`/channels/${channelId}/stats`);
      set({ channelStats: response.data });
    } catch (error) {
      console.error('Failed to fetch channel stats:', error);
      set({ channelStats: getMockChannelStats() });
    }
  },

  // Fetch messages
  fetchMessages: async (filters = {}) => {
    set({ messagesLoading: true });
    try {
      const params = { ...get().messageFilters, ...filters };
      const response = await api.get('/messages', { params });
      set({
        messages: response.data?.messages || response.data || [],
        messagesLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      set({
        messages: getMockMessages(),
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
      const response = await api.get('/stats');
      set({
        globalStats: response.data,
        statsLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      set({
        globalStats: {
          totalChannels: 47,
          totalMessages: 12843,
          totalAnalyzed: 8921,
          totalVoices: 342,
          channelGrowth: '+12%',
          messageGrowth: '+23%',
          analyzedGrowth: '+18%',
          voiceGrowth: '+8%',
        },
        statsLoading: false,
      });
    }
  },

  // Fetch insights
  fetchInsights: async () => {
    set({ insightsLoading: true });
    try {
      const response = await api.get('/insights');
      set({
        insights: response.data,
        insightsLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch insights:', error);
      set({
        insights: getMockInsights(),
        insightsLoading: false,
      });
    }
  },

  // Fetch analysis data
  fetchAnalysis: async (filters = {}) => {
    set({ analysisLoading: true });
    try {
      const response = await api.get('/analysis', { params: filters });
      set({
        analysisData: response.data?.results || response.data || [],
        analysisLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch analysis:', error);
      set({
        analysisData: getMockAnalysisData(),
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
      await api.post('/telegram/sync');
      await get().fetchChannels();
      set({ syncing: false });
    } catch (error) {
      console.error('Failed to sync Telegram:', error);
      // Add mock pending channels on failure
      set((state) => ({
        syncing: false,
        pendingChannels: [
          ...state.pendingChannels,
          ...getMockNewPendingChannels(),
        ],
      }));
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

// ---- Mock Data Functions ----

function getMockApprovedChannels() {
  return [
    {
      id: 1,
      title: 'Crypto Signals Pro',
      username: '@cryptosignalspro',
      description: 'Premium crypto trading signals with 85% win rate. Daily analysis and market insights.',
      subscribers: 45200,
      growth_7d: 12.5,
      messages_per_day: 18,
      avg_engagement: 4.2,
      category: 'Crypto',
      status: 'approved',
      source: 'telegram',
    },
    {
      id: 2,
      title: 'Forex Masters',
      username: '@forexmasters',
      description: 'Professional forex signals. EUR/USD, GBP/USD specialist.',
      subscribers: 32100,
      growth_7d: 8.3,
      messages_per_day: 12,
      avg_engagement: 3.8,
      category: 'Forex',
      status: 'approved',
      source: 'telegram',
    },
    {
      id: 3,
      title: 'Options Flow Alert',
      username: '@optionsflow',
      description: 'Real-time unusual options activity alerts. Dark pool data.',
      subscribers: 28400,
      growth_7d: -2.1,
      messages_per_day: 25,
      avg_engagement: 5.1,
      category: 'Options',
      status: 'approved',
      source: 'telegram',
    },
    {
      id: 4,
      title: 'Stock Picks Daily',
      username: '@stockpicksdaily',
      description: 'Daily stock picks with technical and fundamental analysis.',
      subscribers: 19800,
      growth_7d: 5.7,
      messages_per_day: 8,
      avg_engagement: 3.2,
      category: 'Stocks',
      status: 'approved',
      source: 'telegram',
    },
    {
      id: 5,
      title: 'DeFi Alpha Hunters',
      username: '@defialpha',
      description: 'Early DeFi opportunities, yield farming strategies, and protocol analysis.',
      subscribers: 15600,
      growth_7d: 22.1,
      messages_per_day: 6,
      avg_engagement: 6.8,
      category: 'Crypto',
      status: 'approved',
      source: 'telegram',
    },
  ];
}

function getMockPendingChannels() {
  return [
    {
      id: 101,
      title: 'Whale Tracker BTC',
      username: '@whaletrackerbtc',
      description: 'Track whale movements and large BTC transactions.',
      subscribers: 8900,
      source: 'telegram',
      status: 'pending',
      discovered_at: '2026-02-05T14:30:00Z',
    },
    {
      id: 102,
      title: 'Scalping Academy',
      username: '@scalpingacademy',
      description: 'Learn scalping techniques. Live trades daily.',
      subscribers: 5200,
      source: 'telegram',
      status: 'pending',
      discovered_at: '2026-02-05T12:15:00Z',
    },
    {
      id: 103,
      title: 'Macro Economics Daily',
      username: '@macrodaily',
      description: 'Daily macro economic analysis affecting markets.',
      subscribers: 12300,
      source: 'telegram',
      status: 'pending',
      discovered_at: '2026-02-04T09:45:00Z',
    },
  ];
}

function getMockNewPendingChannels() {
  return [
    {
      id: 104,
      title: 'NFT Trading Alerts',
      username: '@nfttradingalerts',
      description: 'Floor price alerts and NFT flip opportunities.',
      subscribers: 3400,
      source: 'telegram',
      status: 'pending',
      discovered_at: new Date().toISOString(),
    },
    {
      id: 105,
      title: 'Gold & Commodities',
      username: '@goldcommodities',
      description: 'Precious metals and commodities trading signals.',
      subscribers: 7800,
      source: 'telegram',
      status: 'pending',
      discovered_at: new Date().toISOString(),
    },
  ];
}

function getMockChannelDetail(channelId) {
  return {
    id: channelId,
    title: 'Channel #' + channelId,
    username: '@channel' + channelId,
    description: 'Trading channel with detailed analysis and signals.',
    subscribers: 15000,
    growth_7d: 5.5,
    messages_per_day: 10,
    avg_engagement: 4.0,
    category: 'Trading',
    status: 'approved',
    source: 'telegram',
    subscriber_history: [
      { date: '2026-01-01', count: 12000 },
      { date: '2026-01-08', count: 12500 },
      { date: '2026-01-15', count: 13100 },
      { date: '2026-01-22', count: 13800 },
      { date: '2026-01-29', count: 14400 },
      { date: '2026-02-05', count: 15000 },
    ],
    recent_messages: getMockMessages().slice(0, 5),
    patterns: {
      hook_types: [
        { type: 'urgency', count: 45 },
        { type: 'social_proof', count: 38 },
        { type: 'scarcity', count: 22 },
        { type: 'authority', count: 18 },
      ],
      cta_types: [
        { type: 'join_group', count: 32 },
        { type: 'click_link', count: 28 },
        { type: 'dm_me', count: 15 },
        { type: 'use_code', count: 12 },
      ],
    },
  };
}

function getMockChannelStats() {
  return {
    subscriber_history: [
      { date: '2026-01-01', count: 12000 },
      { date: '2026-01-08', count: 12500 },
      { date: '2026-01-15', count: 13100 },
      { date: '2026-01-22', count: 13800 },
      { date: '2026-01-29', count: 14400 },
      { date: '2026-02-05', count: 15000 },
    ],
    messages_per_day_history: [
      { date: 'Mon', count: 12 },
      { date: 'Tue', count: 15 },
      { date: 'Wed', count: 8 },
      { date: 'Thu', count: 22 },
      { date: 'Fri', count: 18 },
      { date: 'Sat', count: 6 },
      { date: 'Sun', count: 4 },
    ],
  };
}

function getMockMessages() {
  return [
    {
      id: 1,
      channel_id: 1,
      channel_name: 'Crypto Signals Pro',
      text: 'BTC just broke the $95k resistance! Our members got in at $92k. Join the VIP group for the next trade setup. Limited spots remaining!',
      hook_type: 'urgency',
      cta_type: 'join_group',
      score: 8.5,
      views: 12400,
      forwards: 340,
      date: '2026-02-05T18:30:00Z',
      analysis: {
        hook: 'Creates urgency with "just broke" and "limited spots"',
        cta: 'Directs to VIP group membership',
        persuasion_techniques: ['social proof', 'scarcity', 'FOMO'],
        estimated_conversion: '3.2%',
      },
    },
    {
      id: 2,
      channel_id: 2,
      channel_name: 'Forex Masters',
      text: 'EUR/USD Analysis: Strong support at 1.0850. Our last 5 calls were all winners. Get the next setup in our premium channel.',
      hook_type: 'social_proof',
      cta_type: 'click_link',
      score: 7.2,
      views: 8900,
      forwards: 180,
      date: '2026-02-05T15:20:00Z',
      analysis: {
        hook: 'Uses track record (5 winners) as social proof',
        cta: 'Links to premium channel',
        persuasion_techniques: ['authority', 'social proof'],
        estimated_conversion: '2.1%',
      },
    },
    {
      id: 3,
      channel_id: 3,
      channel_name: 'Options Flow Alert',
      text: 'UNUSUAL ACTIVITY: $5M in AAPL calls expiring this Friday. Smart money is positioning. Full breakdown for premium members only.',
      hook_type: 'authority',
      cta_type: 'join_group',
      score: 9.1,
      views: 15600,
      forwards: 520,
      date: '2026-02-05T12:10:00Z',
      analysis: {
        hook: 'Appeals to authority with "smart money" and specific dollar amounts',
        cta: 'Restricts full info to premium members',
        persuasion_techniques: ['authority', 'information gap', 'exclusivity'],
        estimated_conversion: '4.5%',
      },
    },
    {
      id: 4,
      channel_id: 1,
      channel_name: 'Crypto Signals Pro',
      text: 'ALERT: ETH setup forming. Last time this pattern appeared, ETH pumped 40%. DM me "ETH" for the entry point.',
      hook_type: 'scarcity',
      cta_type: 'dm_me',
      score: 7.8,
      views: 11200,
      forwards: 290,
      date: '2026-02-04T20:45:00Z',
      analysis: {
        hook: 'References historical pattern for credibility and FOMO',
        cta: 'DM engagement for personal connection',
        persuasion_techniques: ['anchoring', 'FOMO', 'reciprocity'],
        estimated_conversion: '2.8%',
      },
    },
    {
      id: 5,
      channel_id: 4,
      channel_name: 'Stock Picks Daily',
      text: 'NVDA earnings next week. Our AI model predicts a 15% move. Use code STOCK20 for 20% off premium access.',
      hook_type: 'authority',
      cta_type: 'use_code',
      score: 6.5,
      views: 6800,
      forwards: 95,
      date: '2026-02-04T16:30:00Z',
      analysis: {
        hook: 'Uses AI/tech authority and specific prediction',
        cta: 'Discount code creates urgency and tracks conversion',
        persuasion_techniques: ['authority', 'anchoring', 'reciprocity'],
        estimated_conversion: '1.9%',
      },
    },
    {
      id: 6,
      channel_id: 5,
      channel_name: 'DeFi Alpha Hunters',
      text: 'NEW FARM: 450% APY on the new SushiSwap pool. Only early users will get these rates. Step-by-step guide in premium.',
      hook_type: 'scarcity',
      cta_type: 'click_link',
      score: 8.0,
      views: 9200,
      forwards: 410,
      date: '2026-02-04T10:15:00Z',
      analysis: {
        hook: 'High APY number creates greed, "only early users" adds scarcity',
        cta: 'Guide behind paywall',
        persuasion_techniques: ['scarcity', 'greed', 'FOMO'],
        estimated_conversion: '3.8%',
      },
    },
  ];
}

function getMockAnalysisData() {
  return getMockMessages().map((msg) => ({
    ...msg,
    analyzed: true,
    analyzed_at: '2026-02-05T20:00:00Z',
  }));
}

function getMockInsights() {
  return {
    topHooks: [
      { type: 'Urgency/FOMO', count: 342, avgScore: 8.2 },
      { type: 'Social Proof', count: 289, avgScore: 7.5 },
      { type: 'Authority', count: 234, avgScore: 7.8 },
      { type: 'Scarcity', count: 198, avgScore: 8.0 },
      { type: 'Reciprocity', count: 156, avgScore: 6.9 },
      { type: 'Curiosity Gap', count: 134, avgScore: 7.1 },
    ],
    bestCTAs: [
      { type: 'Join VIP Group', count: 245, conversionRate: 4.2 },
      { type: 'Click Link', count: 312, conversionRate: 2.8 },
      { type: 'DM for Info', count: 178, conversionRate: 5.1 },
      { type: 'Use Promo Code', count: 134, conversionRate: 3.5 },
      { type: 'Forward to Friend', count: 89, conversionRate: 1.9 },
    ],
    optimalHours: generateHeatmapData(),
    trendingKeywords: [
      { word: 'BTC', count: 892 },
      { word: 'signal', count: 756 },
      { word: 'profit', count: 645 },
      { word: 'VIP', count: 589 },
      { word: 'premium', count: 534 },
      { word: 'alert', count: 498 },
      { word: 'breakout', count: 423 },
      { word: 'entry', count: 389 },
      { word: 'target', count: 367 },
      { word: 'stop loss', count: 312 },
      { word: 'ETH', count: 298 },
      { word: 'leverage', count: 267 },
      { word: 'pump', count: 234 },
      { word: 'moon', count: 198 },
      { word: 'FOMO', count: 176 },
    ],
  };
}

function generateHeatmapData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      let intensity;
      if (h >= 8 && h <= 10) intensity = 60 + Math.random() * 40;
      else if (h >= 14 && h <= 16) intensity = 50 + Math.random() * 50;
      else if (h >= 20 && h <= 22) intensity = 40 + Math.random() * 40;
      else if (h >= 0 && h <= 5) intensity = Math.random() * 15;
      else intensity = 15 + Math.random() * 35;

      if (d >= 5) intensity *= 0.6;

      data.push({
        day: days[d],
        dayIndex: d,
        hour: h,
        value: Math.round(intensity),
      });
    }
  }
  return data;
}

export default useAppStore;
