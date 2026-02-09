import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  Forward,
  ChevronDown,
  Loader2,
  Smartphone,
  Image,
  Mic,
  Video,
  FileText,
  Play,
} from 'lucide-react';
import api from '../utils/api';
import useAppStore from '../stores/appStore';

const PAGE_SIZE = 50;

// Exact Telegram dark mode colors
const TG = {
  bg: '#0e1621',
  bubble: '#182533',
  header: '#17212b',
  text: '#ffffff',
  link: '#6ab2f2',
  views: '#707579',
  reactionBg: '#2b3e50',
  reactionText: '#ffffff',
  highlight: '#6ec05a',
  datePill: '#182533',
  datePillText: '#8b9caf',
};

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function getEngagementBorder(score) {
  if (score === null || score === undefined) return '';
  if (score >= 7) return 'border-l-4 border-l-emerald-500';
  if (score >= 4) return 'border-l-4 border-l-amber-500';
  return '';
}

function getEngagementDot(score) {
  if (score === null || score === undefined) return null;
  if (score >= 7)
    return <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title={`Score: ${score}/10`} />;
  if (score >= 4)
    return <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" title={`Score: ${score}/10`} />;
  return null;
}

function ContentTypeBadge({ type, duration }) {
  const badges = {
    photo: { icon: Image, label: 'Photo', color: 'text-blue-400 bg-blue-500/10' },
    video: { icon: Video, label: 'Video', color: 'text-purple-400 bg-purple-500/10' },
    voice: {
      icon: Mic,
      label: `Voice ${duration ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : ''}`,
      color: 'text-rose-400 bg-rose-500/10',
    },
    document: { icon: FileText, label: 'Document', color: 'text-amber-400 bg-amber-500/10' },
  };

  const badge = badges[type];
  if (!badge) return null;
  const Icon = badge.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${badge.color} mb-2`}>
      <Icon className="w-3.5 h-3.5" />
      {badge.label}
    </div>
  );
}

function MessageBubble({ message }) {
  const borderClass = getEngagementBorder(message.engagement_score);
  const dot = getEngagementDot(message.engagement_score);
  const reactions = message.reactions_json ? (() => { try { return JSON.parse(message.reactions_json); } catch { return []; } })() : [];
  const hasMedia = message.media_url && (message.content_type === 'photo' || message.content_type === 'video');

  return (
    <div className={`rounded-xl max-w-full overflow-hidden ${borderClass}`} style={{ backgroundColor: TG.bubble }}>
      {/* Forward header */}
      {message.forward_from && (
        <div className="px-3.5 pt-2.5 pb-1">
          <div style={{ borderLeft: `2px solid ${TG.link}`, paddingLeft: '8px' }}>
            <p className="text-[11px] font-medium" style={{ color: TG.link }}>
              Forwarded from
            </p>
            <p className="text-[12px] font-semibold" style={{ color: TG.link }}>
              {message.forward_from}
            </p>
          </div>
        </div>
      )}

      {/* Media thumbnail */}
      {hasMedia ? (
        <div className="relative">
          <img
            src={message.media_url}
            alt=""
            className="w-full object-cover"
            style={{ maxHeight: '220px', minHeight: '80px' }}
            loading="lazy"
          />
          {message.content_type === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
              </div>
            </div>
          )}
        </div>
      ) : message.content_type && message.content_type !== 'text' && !message.text_content ? (
        <div className="px-3.5 pt-2.5">
          <ContentTypeBadge type={message.content_type} duration={message.voice_duration} />
        </div>
      ) : null}

      {/* Text + meta area */}
      <div className="px-3.5 py-2">
        {/* Badge for media+text combo (no thumbnail available) */}
        {message.content_type && message.content_type !== 'text' && !hasMedia && message.text_content && (
          <ContentTypeBadge type={message.content_type} duration={message.voice_duration} />
        )}

        {/* Message text */}
        {message.text_content && (
          <p
            className="text-[13px] leading-[1.4] whitespace-pre-wrap break-words"
            style={{ color: TG.text }}
          >
            {message.text_content}
          </p>
        )}

        {/* Reaction pills */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {reactions.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px]"
                style={{ backgroundColor: TG.reactionBg, color: TG.reactionText }}
              >
                {r.emoji} {formatNumber(r.count)}
              </span>
            ))}
          </div>
        )}

        {/* Bottom row: engagement + views + time */}
        <div className="flex items-center justify-end gap-2 mt-1.5">
          {dot}
          {message.engagement_score != null && (
            <span className="text-[10px]" style={{ color: TG.views }}>
              {message.engagement_score.toFixed(1)}/10
            </span>
          )}
          <div className="flex items-center gap-1" style={{ color: TG.views }}>
            <Eye className="w-3 h-3" />
            <span className="text-[10px]">{formatNumber(message.views_count)}</span>
          </div>
          {message.forwards_count > 0 && (
            <div className="flex items-center gap-1" style={{ color: TG.views }}>
              <Forward className="w-3 h-3" />
              <span className="text-[10px]">{formatNumber(message.forwards_count)}</span>
            </div>
          )}
          <span className="text-[10px]" style={{ color: TG.views }}>
            {formatTime(message.posted_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

function DateSeparator({ date }) {
  return (
    <div className="flex items-center justify-center my-3">
      <span
        className="px-3 py-1 rounded-full text-[11px] font-medium"
        style={{ backgroundColor: TG.datePill, color: TG.datePillText }}
      >
        {new Date(date).toLocaleDateString([], {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </span>
    </div>
  );
}

function PinnedBanner({ message }) {
  if (!message) return null;
  const text = message.text_content
    ? message.text_content.substring(0, 60) + (message.text_content.length > 60 ? '...' : '')
    : '[Media]';

  return (
    <div
      className="relative z-20 flex items-center gap-2 px-3 py-2"
      style={{ backgroundColor: TG.header, borderBottom: `1px solid ${TG.bg}` }}
    >
      <span className="text-sm flex-shrink-0">📌</span>
      <div className="flex-1 min-w-0" style={{ borderLeft: `2px solid ${TG.link}`, paddingLeft: '8px' }}>
        <p className="text-[10px] font-medium" style={{ color: TG.link }}>Pinned Message</p>
        <p className="text-[11px] truncate" style={{ color: TG.text }}>{text}</p>
      </div>
    </div>
  );
}

function PhoneMockup({ children, channelName, subscriberCount, photoUrl, pinnedMessage, onSwitchChannel, channels, currentChannelId, mini = false }) {
  const frameWidth = mini ? 'w-[280px]' : 'w-[375px]';
  const frameHeight = mini ? 'h-[500px]' : 'h-[740px]';
  const hasPinned = !mini && pinnedMessage;

  return (
    <div className={`relative ${frameWidth} ${frameHeight} mx-auto`}>
      {/* Phone outer frame */}
      <div
        className={`absolute inset-0 shadow-2xl ${mini ? 'rounded-[30px]' : 'rounded-[40px]'}`}
        style={{
          background: 'linear-gradient(145deg, #2a2a2e, #1a1a1e)',
          padding: mini ? '8px' : '12px',
        }}
      >
        {/* Screen bezel */}
        <div
          className="relative w-full h-full overflow-hidden"
          style={{
            borderRadius: mini ? '22px' : '28px',
            backgroundColor: TG.bg,
          }}
        >
          {/* Notch */}
          {!mini && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30">
              <div
                className="rounded-b-2xl"
                style={{ width: '150px', height: '28px', backgroundColor: '#1a1a1e' }}
              />
            </div>
          )}

          {/* Status bar */}
          <div
            className="relative z-20 flex items-center justify-between px-6"
            style={{ height: mini ? '24px' : '44px', backgroundColor: TG.header }}
          >
            {!mini && (
              <>
                <span className="text-[11px] font-semibold text-white/80">9:41</span>
                <div className="flex items-center gap-1">
                  <div className="flex gap-[2px]">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="rounded-[1px]"
                        style={{
                          width: '3px',
                          height: `${6 + i * 2}px`,
                          backgroundColor: i <= 3 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-white/60 ml-1">100%</span>
                </div>
              </>
            )}
          </div>

          {/* Telegram header */}
          <div
            className="relative z-20 flex items-center gap-3 px-3"
            style={{
              height: mini ? '44px' : '52px',
              backgroundColor: TG.header,
              borderBottom: `1px solid ${TG.bg}`,
            }}
          >
            {/* Channel avatar - real photo or fallback */}
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={channelName}
                className={`${mini ? 'w-8 h-8' : 'w-10 h-10'} rounded-full object-cover flex-shrink-0`}
              />
            ) : (
              <div
                className={`${mini ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center flex-shrink-0`}
                style={{ backgroundColor: '#5b9bd5' }}
              >
                <span className={`font-bold text-white ${mini ? 'text-xs' : 'text-sm'}`}>
                  {(channelName || '?')[0].toUpperCase()}
                </span>
              </div>
            )}

            {/* Channel info */}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-white truncate ${mini ? 'text-xs' : 'text-sm'}`}>{channelName}</p>
              <p className={`${mini ? 'text-[10px]' : 'text-xs'}`} style={{ color: TG.views }}>
                {subscriberCount ? `${formatNumber(subscriberCount)} subscribers` : 'channel'}
              </p>
            </div>

            {/* Channel switcher button */}
            {!mini && channels && channels.length > 1 && (
              <button
                onClick={onSwitchChannel}
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Smartphone className="w-4 h-4 text-zinc-400" />
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>
            )}
          </div>

          {/* Pinned message banner */}
          {hasPinned && <PinnedBanner message={pinnedMessage} />}

          {/* Content area */}
          <div
            className="relative z-10 flex-1 overflow-hidden"
            style={{ height: `calc(100% - ${mini ? '68px' : hasPinned ? '132px' : '96px'})` }}
          >
            {children}
          </div>
        </div>
      </div>

      {/* Side buttons */}
      {!mini && (
        <>
          <div className="absolute rounded-r-sm" style={{ left: '-2px', top: '120px', width: '3px', height: '28px', backgroundColor: '#333' }} />
          <div className="absolute rounded-r-sm" style={{ left: '-2px', top: '160px', width: '3px', height: '48px', backgroundColor: '#333' }} />
          <div className="absolute rounded-r-sm" style={{ left: '-2px', top: '218px', width: '3px', height: '48px', backgroundColor: '#333' }} />
          <div className="absolute rounded-l-sm" style={{ right: '-2px', top: '170px', width: '3px', height: '60px', backgroundColor: '#333' }} />
        </>
      )}
    </div>
  );
}

export default function ChannelPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { channels, fetchChannels } = useAppStore();

  const [feedData, setFeedData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [showSwitcher, setShowSwitcher] = useState(false);

  const scrollRef = useRef(null);
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  const fetchFeed = useCallback(
    async (skip = 0, append = false) => {
      if (skip === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        const response = await api.get(`/messages/feed/${id}`, {
          params: { skip, limit: PAGE_SIZE },
        });
        const data = response.data;

        if (!append) {
          setFeedData(data);
          setMessages(data.messages);
        } else {
          setMessages((prev) => [...prev, ...data.messages]);
        }

        setTotal(data.total);
        setHasMore(skip + PAGE_SIZE < data.total);
      } catch (error) {
        console.error('Failed to fetch feed:', error);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [id]
  );

  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    fetchFeed(0, false);
  }, [fetchFeed]);

  useEffect(() => {
    if (channels.length === 0) fetchChannels();
  }, [channels, fetchChannels]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchFeed(messages.length, true);
        }
      },
      { root: scrollRef.current, threshold: 0.1 }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, loadingMore, loading, messages.length, fetchFeed]);

  // Group messages by date for date separators
  const groupedMessages = [];
  let lastDate = null;
  for (const msg of messages) {
    const msgDate = msg.posted_at ? new Date(msg.posted_at).toDateString() : null;
    if (msgDate && msgDate !== lastDate) {
      groupedMessages.push({ type: 'date', date: msg.posted_at });
      lastDate = msgDate;
    }
    groupedMessages.push({ type: 'message', data: msg });
  }

  const channel = feedData?.channel;
  const pinnedMessage = messages.find((m) => m.is_pinned);

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/channels/${id}`)}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Channel</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">
            {total} messages
          </span>
          <button
            onClick={() => navigate(`/channels/${id}/persona`)}
            className="px-3 py-1.5 text-sm text-violet-400 hover:text-violet-300 border border-violet-500/30 rounded-lg hover:bg-violet-500/10 transition-colors"
          >
            View Persona
          </button>
        </div>
      </div>

      {/* Phone mockup centered */}
      <div className="flex justify-center py-4">
        {loading && !feedData ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : (
          <div className="relative">
            <PhoneMockup
              channelName={channel?.title || 'Channel'}
              subscriberCount={channel?.subscribers_count}
              photoUrl={channel?.photo_url}
              pinnedMessage={pinnedMessage}
              channels={channels}
              currentChannelId={Number(id)}
              onSwitchChannel={() => setShowSwitcher(!showSwitcher)}
            >
              {/* Scrollable message feed */}
              <div
                ref={scrollRef}
                className="h-full overflow-y-auto px-2 py-2 space-y-2"
                style={{ backgroundColor: TG.bg }}
              >
                {groupedMessages.map((item, i) =>
                  item.type === 'date' ? (
                    <DateSeparator key={`date-${i}`} date={item.date} />
                  ) : (
                    <MessageBubble key={item.data.id} message={item.data} />
                  )
                )}

                {/* Loading more indicator */}
                {loadingMore && (
                  <div className="flex justify-center py-3">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: TG.link }} />
                  </div>
                )}

                {/* Sentinel for infinite scroll */}
                <div ref={sentinelRef} className="h-4" />

                {!hasMore && messages.length > 0 && (
                  <div className="flex justify-center py-3">
                    <span
                      className="text-[11px] px-3 py-1 rounded-full"
                      style={{ backgroundColor: TG.datePill, color: TG.datePillText }}
                    >
                      Beginning of channel history
                    </span>
                  </div>
                )}
              </div>
            </PhoneMockup>

            {/* Channel Switcher Dropdown */}
            {showSwitcher && (
              <div className="absolute top-24 right-0 z-50 w-64 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
                <div className="p-3 border-b border-zinc-800">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Switch Channel</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {channels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => {
                        setShowSwitcher(false);
                        navigate(`/channels/${ch.id}/preview`);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        String(ch.id) === String(id)
                          ? 'bg-emerald-500/10'
                          : 'hover:bg-zinc-800'
                      }`}
                    >
                      {ch.photo_url ? (
                        <img src={ch.photo_url} alt={ch.title} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#5b9bd5' }}>
                          <span className="text-xs font-bold text-white">
                            {(ch.title || '?')[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${String(ch.id) === String(id) ? 'text-emerald-400 font-medium' : 'text-zinc-300'}`}>
                          {ch.title}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {ch.username ? `@${ch.username}` : ''}
                        </p>
                      </div>
                      {String(ch.id) === String(id) && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Engagement legend */}
            <div className="flex items-center justify-center gap-6 mt-6">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-emerald-500" />
                <span className="text-xs text-zinc-500">Top performer (7+)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-amber-500" />
                <span className="text-xs text-zinc-500">Medium (4-7)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-zinc-700" />
                <span className="text-xs text-zinc-500">Normal</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export the mini phone component for use in ChannelPersona
export function MiniPhonePreview({ channelId, channelName, subscriberCount }) {
  const [messages, setMessages] = useState([]);
  const [channelData, setChannelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchFeed = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/messages/feed/${channelId}`, {
          params: { skip: 0, limit: 20 },
        });
        setMessages(response.data.messages || []);
        setChannelData(response.data.channel || null);
      } catch (error) {
        console.error('Failed to fetch mini feed:', error);
      }
      setLoading(false);
    };
    fetchFeed();
  }, [channelId]);

  // Group messages by date
  const groupedMessages = [];
  let lastDate = null;
  for (const msg of messages) {
    const msgDate = msg.posted_at ? new Date(msg.posted_at).toDateString() : null;
    if (msgDate && msgDate !== lastDate) {
      groupedMessages.push({ type: 'date', date: msg.posted_at });
      lastDate = msgDate;
    }
    groupedMessages.push({ type: 'message', data: msg });
  }

  return (
    <PhoneMockup
      channelName={channelData?.title || channelName}
      subscriberCount={channelData?.subscribers_count || subscriberCount}
      photoUrl={channelData?.photo_url}
      mini={true}
    >
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto px-2 py-2 space-y-1.5"
        style={{ backgroundColor: TG.bg }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: TG.link }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs" style={{ color: TG.views }}>No messages yet</p>
          </div>
        ) : (
          groupedMessages.map((item, i) =>
            item.type === 'date' ? (
              <DateSeparator key={`date-${i}`} date={item.date} />
            ) : (
              <MessageBubble key={item.data.id} message={item.data} />
            )
          )
        )}
      </div>
    </PhoneMockup>
  );
}
