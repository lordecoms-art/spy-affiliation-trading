import { useState, useEffect } from 'react';
import {
  Save,
  Wifi,
  WifiOff,
  Key,
  Clock,
  Hash,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import Card from '../components/Card';
import useAppStore from '../stores/appStore';

export default function Settings() {
  const {
    settings,
    settingsLoading,
    saveSettings,
    channels,
    pendingChannels,
    fetchChannels,
    fetchHealthStatus,
    healthStatus,
    syncTelegram,
    syncing,
  } = useAppStore();
  const [localSettings, setLocalSettings] = useState(settings);
  const [anthropicKey, setAnthropicKey] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchHealthStatus();
    fetchChannels();
  }, [fetchHealthStatus, fetchChannels]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const telegramConnected = healthStatus?.telegram_configured === true;
  const totalChannels = channels.length + pendingChannels.length;

  const handleChange = (key, value) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const addCategory = () => {
    if (newCategory.trim() && !localSettings.categories.includes(newCategory.trim())) {
      setLocalSettings((prev) => ({
        ...prev,
        categories: [...prev.categories, newCategory.trim()],
      }));
      setNewCategory('');
    }
  };

  const removeCategory = (category) => {
    setLocalSettings((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c !== category),
    }));
  };

  const handleSave = async () => {
    const settingsToSave = { ...localSettings };
    if (anthropicKey) {
      settingsToSave.anthropicKey = anthropicKey;
      settingsToSave.anthropicKeySet = true;
    }
    await saveSettings(settingsToSave);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSync = async () => {
    try {
      await syncTelegram();
      await fetchHealthStatus();
    } catch (e) {
      console.error('Sync failed:', e);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Scraping Configuration */}
      <Card>
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-5 h-5 text-emerald-500" />
          <h3 className="text-lg font-semibold text-zinc-100">
            Scraping Configuration
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Scrape Interval (minutes)
            </label>
            <input
              type="number"
              min="5"
              max="1440"
              value={localSettings.scrapeInterval}
              onChange={(e) =>
                handleChange('scrapeInterval', Number(e.target.value))
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-300 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
            />
            <p className="text-xs text-zinc-500 mt-1.5">
              How often to check channels for new messages (min: 5, max: 1440)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Message Limit per Channel
            </label>
            <input
              type="number"
              min="10"
              max="500"
              value={localSettings.messageLimit}
              onChange={(e) =>
                handleChange('messageLimit', Number(e.target.value))
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-300 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
            />
            <p className="text-xs text-zinc-500 mt-1.5">
              Maximum messages to collect per scrape cycle (min: 10, max: 500)
            </p>
          </div>
        </div>
      </Card>

      {/* Telegram Connection */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {telegramConnected ? (
              <Wifi className="w-5 h-5 text-emerald-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            <h3 className="text-lg font-semibold text-zinc-100">
              Telegram Connection
            </h3>
          </div>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              telegramConnected
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-red-500/10 text-red-500'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                telegramConnected
                  ? 'bg-emerald-500'
                  : 'bg-red-500'
              }`}
            />
            <span>
              {telegramConnected
                ? `Connected (${totalChannels} channels)`
                : 'Not Connected'}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            {telegramConnected
              ? `Your Telegram account is connected and monitoring ${totalChannels} channels (${channels.length} approved, ${pendingChannels.length} pending).`
              : 'Connect your Telegram account to start monitoring channels. Configure the Telegram API credentials in the backend environment variables.'}
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>{syncing ? 'Syncing...' : 'Sync Telegram Channels'}</span>
          </button>
        </div>
      </Card>

      {/* Anthropic API Key */}
      <Card>
        <div className="flex items-center gap-2 mb-6">
          <Key className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-zinc-100">
            Anthropic API Key
          </h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            API Key
          </label>
          <div className="relative">
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder={
                healthStatus?.anthropic_configured
                  ? 'sk-ant-***...*** (key is set)'
                  : 'Enter your Anthropic API key'
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
            />
            {healthStatus?.anthropic_configured && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1.5">
            Used for AI-powered message analysis. Your key is encrypted at rest.
          </p>
        </div>
      </Card>

      {/* Channel Categories */}
      <Card>
        <div className="flex items-center gap-2 mb-6">
          <Hash className="w-5 h-5 text-cyan-500" />
          <h3 className="text-lg font-semibold text-zinc-100">
            Channel Categories
          </h3>
        </div>

        <div className="space-y-4">
          {/* Existing categories */}
          <div className="flex flex-wrap gap-2">
            {localSettings.categories.map((category) => (
              <div
                key={category}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-lg text-sm text-zinc-300"
              >
                <span>{category}</span>
                <button
                  onClick={() => removeCategory(category)}
                  className="text-zinc-500 hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add category */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              placeholder="Add new category..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:border-emerald-500/50"
            />
            <button
              onClick={addCategory}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-emerald-500 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-4">
        {saved && (
          <div className="flex items-center gap-2 text-emerald-500 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings saved successfully</span>
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={settingsLoading}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {settingsLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{settingsLoading ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>
    </div>
  );
}
