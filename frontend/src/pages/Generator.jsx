import { useEffect, useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Shuffle,
} from 'lucide-react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import useAppStore from '../stores/appStore';
import api from '../utils/api';

const MESSAGE_TYPES = [
  { value: 'hook', label: 'Hook / Accroche' },
  { value: 'social_proof', label: 'Social Proof / Preuve sociale' },
  { value: 'cta', label: 'Call-to-Action' },
  { value: 'story', label: 'Storytelling' },
  { value: 'educational', label: 'Educational / Éducatif' },
  { value: 'urgency', label: 'Urgency / Urgence' },
  { value: 'results', label: 'Results / Résultats' },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function Generator() {
  const { channels, fetchChannels } = useAppStore();
  const [selectedChannel, setSelectedChannel] = useState('');
  const [selectedChannel2, setSelectedChannel2] = useState('');
  const [messageType, setMessageType] = useState('hook');
  const [subject, setSubject] = useState('');
  const [variants, setVariants] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [remixMode, setRemixMode] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const generateVariants = async () => {
    if (!selectedChannel || !subject.trim()) return;
    setGenerating(true);
    setVariants([]);

    try {
      const channelIds = [selectedChannel];
      if (remixMode && selectedChannel2) {
        channelIds.push(selectedChannel2);
      }

      const response = await api.post('/persona/generate-content', {
        channel_ids: channelIds.map(Number),
        message_type: messageType,
        subject: subject.trim(),
        remix: remixMode && !!selectedChannel2,
        num_variants: 5,
      }, { timeout: 120000 });

      setVariants(response.data.variants || []);
    } catch (error) {
      console.error('Failed to generate variants:', error);
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-zinc-800">
            <Sparkles className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">Content Generator</h3>
            <p className="text-sm text-zinc-500">Generate content inspired by tracked channels</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Channel selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Channel Model
            </label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
            >
              <option value="">Select a channel...</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.title} ({(ch.subscribers_count || 0).toLocaleString()} subs)
                </option>
              ))}
            </select>
          </div>

          {/* Message type */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Message Type
            </label>
            <select
              value={messageType}
              onChange={(e) => setMessageType(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
            >
              {MESSAGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Subject */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Subject / Product
          </label>
          <textarea
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex: Formation trading Forex, Signal crypto gratuit, Coaching personnalisé..."
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-violet-500/50 focus:outline-none resize-none"
          />
        </div>

        {/* Remix mode */}
        <div className="flex items-center gap-4 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={remixMode}
              onChange={(e) => setRemixMode(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-violet-500 focus:ring-violet-500"
            />
            <span className="text-sm text-zinc-300 flex items-center gap-1.5">
              <Shuffle className="w-4 h-4 text-amber-500" />
              Remix Mode (mix 2 channel styles)
            </span>
          </label>

          {remixMode && (
            <select
              value={selectedChannel2}
              onChange={(e) => setSelectedChannel2(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
            >
              <option value="">2nd channel...</option>
              {channels
                .filter((ch) => String(ch.id) !== String(selectedChannel))
                .map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.title}</option>
                ))}
            </select>
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={generateVariants}
          disabled={generating || !selectedChannel || !subject.trim()}
          className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate 5 Variants
            </>
          )}
        </button>
      </Card>

      {/* Generated Variants */}
      {variants.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-zinc-100">
              Generated Variants
            </h3>
            <button
              onClick={generateVariants}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
          </div>

          {variants.map((variant, i) => (
            <Card key={i}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-violet-400">Variant {i + 1}</span>
                  {variant.style && (
                    <Badge variant={variant.style}>{variant.style}</Badge>
                  )}
                </div>
                <CopyButton text={variant.text || variant.content || ''} />
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-800">
                <p className="text-sm text-zinc-200 whitespace-pre-line leading-relaxed">
                  {variant.text || variant.content || ''}
                </p>
              </div>
              {variant.hook_type && (
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant={variant.hook_type}>{variant.hook_type}</Badge>
                  {variant.cta_type && <Badge variant={variant.cta_type}>{variant.cta_type}</Badge>}
                  {variant.explanation && (
                    <span className="text-xs text-zinc-500">{variant.explanation}</span>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {variants.length === 0 && !generating && (
        <Card>
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-zinc-400 mb-2">
              Ready to Generate
            </h4>
            <p className="text-sm text-zinc-500 max-w-md mx-auto">
              Select a channel model, choose a message type, enter your subject,
              and Claude will generate 5 message variants inspired by the channel&apos;s exact style.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
