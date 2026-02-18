import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  BarChart3,
  Type,
  Target,
  TrendingUp,
  Zap,
  Calendar,
  Loader2,
  Sparkles,
  RefreshCw,
  Smartphone,
  Download,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Card from '../components/Card';
import Badge from '../components/Badge';
import api from '../utils/api';
import { MiniPhonePreview } from './ChannelPreview';

const ChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl">
        <p className="text-xs text-zinc-400">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function CollapsibleSection({ title, icon: Icon, iconColor, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-zinc-800`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
        </div>
        {open ? (
          <ChevronDown className="w-5 h-5 text-zinc-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-zinc-500" />
        )}
      </button>
      {open && <div className="mt-6">{children}</div>}
    </Card>
  );
}

function ProgressBar({ label, value, maxValue, color = 'bg-emerald-500' }) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-400 w-28 truncate">{label}</span>
      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-zinc-300 w-16 text-right">{value}</span>
    </div>
  );
}

export default function ChannelPersona() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [persona, setPersona] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiPersona, setAiPersona] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [referenceMessages, setReferenceMessages] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const fetchPersona = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/persona/${id}`);
      setPersona(response.data);
    } catch (error) {
      console.error('Failed to fetch persona:', error);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchPersona();
  }, [fetchPersona]);

  const generateAiPersona = async () => {
    setAiLoading(true);
    try {
      const response = await api.post(`/persona/${id}/generate`, null, { timeout: 120000 });
      setAiPersona(response.data.ai_persona || response.data);
    } catch (error) {
      console.error('Failed to generate AI persona:', error);
    }
    setAiLoading(false);
  };

  const generatePlan = async () => {
    setPlanLoading(true);
    setPlanError(null);
    try {
      const response = await api.post(`/persona/${id}/plan`, null, { timeout: 180000 });
      if (response.data.status === 'error') {
        setPlanError(response.data.error || 'Erreur de génération, réessayez.');
      } else if (response.data.plan) {
        setPlan(response.data.plan);
        setReferenceMessages(response.data.reference_messages || null);
      } else {
        setPlanError('Réponse invalide du serveur. Réessayez.');
      }
    } catch (error) {
      console.error('Failed to generate plan:', error);
      setPlanError('Erreur de génération. Vérifiez la connexion et réessayez.');
    }
    setPlanLoading(false);
  };

  // Draw a print-friendly Telegram-style message bubble in the PDF.
  // Returns the total height consumed.
  const drawTelegramBubble = (doc, msg, x, y, width, channelTitle) => {
    if (!msg) return 0;

    const pad = 3;
    const inner = width - pad * 2;

    // Strip emojis (jsPDF default fonts can't render them)
    const stripEmoji = (str) =>
      (str || '').replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{200D}\u{FE0F}]/gu, '');

    // --- Phase 1: MEASURE height ---
    let h = pad;
    h += 5; // channel name

    if (msg.content_type && msg.content_type !== 'text') h += 4;
    if (msg.forward_from) h += 4;

    let textLines = [];
    const cleanText = stripEmoji(msg.text_content).trim();
    if (cleanText) {
      doc.setFontSize(7.5);
      textLines = doc.splitTextToSize(cleanText, inner);
      h += Math.min(textLines.length, 8) * 3.5;
      if (textLines.length > 8) h += 3.5;
    }

    let reactions = [];
    try { if (msg.reactions_json) reactions = JSON.parse(msg.reactions_json); } catch {}
    if (reactions.length > 0) h += 4.5;

    h += 5; // footer
    h += pad;

    // --- Phase 2: DRAW background ---
    doc.setFillColor(242, 242, 247);
    doc.setDrawColor(210, 210, 215);
    doc.roundedRect(x, y, width, h, 2, 2, 'FD');

    // --- Phase 3: DRAW content ---
    let cy = y + pad;

    // Channel name
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(50, 100, 180);
    doc.text(channelTitle || 'Channel', x + pad, cy + 3);
    cy += 5;

    // Content type badge
    if (msg.content_type && msg.content_type !== 'text') {
      doc.setFontSize(6.5);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(130, 90, 200);
      const labels = { photo: '[ Photo ]', video: '[ Video ]', voice: '[ Voice ]', document: '[ Document ]' };
      doc.text(labels[msg.content_type] || `[ ${msg.content_type} ]`, x + pad, cy + 2.5);
      cy += 4;
    }

    // Forward header
    if (msg.forward_from) {
      doc.setFontSize(6);
      doc.setFont(undefined, 'italic');
      doc.setTextColor(100, 140, 200);
      doc.text(`Forwarded from ${stripEmoji(msg.forward_from)}`, x + pad, cy + 2.5);
      cy += 4;
    }

    // Message text
    if (cleanText) {
      doc.setFontSize(7.5);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(30, 30, 30);
      const maxLines = Math.min(textLines.length, 8);
      for (let i = 0; i < maxLines; i++) {
        doc.text(textLines[i], x + pad, cy + 3);
        cy += 3.5;
      }
      if (textLines.length > 8) {
        doc.setTextColor(120, 120, 120);
        doc.text('...', x + pad, cy + 3);
        cy += 3.5;
      }
    }

    // Reactions
    if (reactions.length > 0) {
      cy += 1;
      doc.setFontSize(6);
      doc.setTextColor(80, 80, 80);
      const reactStr = reactions.slice(0, 5).map((r) => `${stripEmoji(r.emoji || '')} ${r.count}`).join('   ');
      doc.text(reactStr, x + pad, cy + 2.5);
      cy += 3.5;
    }

    // Footer: views + time
    cy += 1;
    doc.setFontSize(6);
    doc.setTextColor(140, 140, 140);
    const views = msg.views_count >= 1000 ? `${(msg.views_count / 1000).toFixed(1)}K views` : `${msg.views_count || 0} views`;
    const time = msg.posted_at ? new Date(msg.posted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    doc.text(`${views}  ${time}`, x + width - pad, cy + 2.5, { align: 'right' });

    return h;
  };

  const exportPlanToPdf = async () => {
    if (!plan) return;
    setPdfLoading(true);

    // Always fetch channel messages for reference bubbles
    let msgList = [];
    try {
      const feedResp = await api.get(`/messages/feed/${id}`, { params: { skip: 0, limit: 50 } });
      msgList = (feedResp.data.messages || []).filter((m) => m.text_content && m.text_content.trim());
    } catch (e) {
      console.error('Failed to fetch messages for PDF:', e);
    }

    // Build a matcher: group messages by content_type, round-robin assign
    const byType = {};
    msgList.forEach((m) => {
      const t = m.content_type || 'text';
      if (!byType[t]) byType[t] = [];
      byType[t].push(m);
    });
    const typeCounters = {};

    const getRefMessage = (post) => {
      // If plan has explicit ref from backend, use it
      if (post.ref && referenceMessages) {
        const found = referenceMessages.find((rm) => rm.ref_index === post.ref);
        if (found) return found;
      }
      // Otherwise match by content_type round-robin
      const t = post.type || 'text';
      const pool = byType[t] || byType['text'] || msgList;
      if (!pool || pool.length === 0) return null;
      if (!typeCounters[t]) typeCounters[t] = 0;
      const msg = pool[typeCounters[t] % pool.length];
      typeCounters[t]++;
      return msg;
    };

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    const addPageIfNeeded = (needed = 20) => {
      if (y + needed > doc.internal.pageSize.getHeight() - 15) {
        doc.addPage();
        y = 20;
      }
    };

    // Title
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('30-Day Content Plan', pageWidth / 2, y, { align: 'center' });
    y += 8;

    // Channel name
    doc.setFontSize(12);
    doc.setTextColor(120, 120, 120);
    doc.text(channel.title || 'Channel', pageWidth / 2, y, { align: 'center' });
    y += 4;

    // Date
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Separator
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Strategy Overview
    if (plan.plan_summary) {
      doc.setFontSize(13);
      doc.setTextColor(180, 130, 20);
      doc.text('Strategy Overview', margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const summaryLines = doc.splitTextToSize(plan.plan_summary, contentWidth);
      doc.text(summaryLines, margin, y);
      y += summaryLines.length * 5 + 6;
    }

    // Weekly Themes
    if (plan.weekly_themes && plan.weekly_themes.length > 0) {
      addPageIfNeeded(30);
      doc.setFontSize(13);
      doc.setTextColor(180, 130, 20);
      doc.text('Weekly Themes', margin, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Week', 'Theme', 'Focus']],
        body: plan.weekly_themes.map((w) => [
          `Week ${w.week}`,
          w.theme || '',
          w.focus || '',
        ]),
        styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
        headStyles: { fillColor: [180, 130, 20], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 248, 240] },
        columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 45 } },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Daily Plan with Telegram reference bubbles
    if (plan.daily_plan && plan.daily_plan.length > 0) {
      addPageIfNeeded(20);
      doc.setFontSize(13);
      doc.setTextColor(180, 130, 20);
      doc.text(`Daily Schedule (${plan.daily_plan.length} days)`, margin, y);
      y += 8;

      plan.daily_plan.forEach((day) => {
        const posts = day.posts || [];

        // Day header
        addPageIfNeeded(15);
        doc.setFillColor(250, 245, 230);
        doc.rect(margin, y, contentWidth, 7, 'F');
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(180, 130, 20);
        doc.text(`J${day.day} - ${day.day_of_week || day.dow || ''}`, margin + 3, y + 5);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(140, 130, 100);
        doc.text(`${posts.length} post${posts.length > 1 ? 's' : ''}`, margin + contentWidth - 3, y + 5, { align: 'right' });
        y += 9;

        posts.forEach((post) => {
          addPageIfNeeded(55);

          // Post info
          doc.setFontSize(9);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(50, 50, 50);
          doc.text(`${post.time || ''}  |  ${post.type || 'text'}`, margin + 2, y + 4);
          y += 5;

          doc.setFontSize(8.5);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(60, 60, 60);
          const topicLines = doc.splitTextToSize(post.content_brief || post.topic || '', contentWidth - 4);
          doc.text(topicLines, margin + 2, y + 3.5);
          y += topicLines.length * 4 + 1;

          if (post.cta) {
            doc.setFontSize(7.5);
            doc.setTextColor(0, 130, 130);
            doc.text(`CTA: ${post.cta}`, margin + 2, y + 3);
            y += 4;
          }

          // Reference message bubble (always shown)
          const refMsg = getRefMessage(post);
          if (refMsg) {
            y += 2;
            addPageIfNeeded(35);
            doc.setFontSize(6.5);
            doc.setTextColor(150, 150, 150);
            doc.setFont(undefined, 'italic');
            doc.text('Telegram reference:', margin + 2, y + 2.5);
            doc.setFont(undefined, 'normal');
            y += 4;

            const bubbleH = drawTelegramBubble(doc, refMsg, margin + 4, y, contentWidth - 8, channel.title);
            y += bubbleH + 3;
          }

          y += 3;
        });

        y += 2;
      });
    }

    // KPIs
    if (plan.kpis && plan.kpis.length > 0) {
      addPageIfNeeded(20);
      doc.setFontSize(13);
      doc.setTextColor(180, 130, 20);
      doc.text('KPIs to Track', margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      plan.kpis.forEach((kpi) => {
        addPageIfNeeded(6);
        doc.text(`•  ${kpi}`, margin + 2, y);
        y += 5;
      });
    }

    // Footer on each page
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text(
        `Page ${i}/${totalPages}  —  Spy Affiliation Trading`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    }

    const filename = `plan-30j-${(channel.title || 'channel').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    doc.save(filename);
    setPdfLoading(false);
  };

  const exportPersonaToPdf = () => {
    if (!aiPersona) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    const addPageIfNeeded = (needed = 20) => {
      if (y + needed > doc.internal.pageSize.getHeight() - 15) {
        doc.addPage();
        y = 20;
      }
    };

    const sectionTitle = (text) => {
      addPageIfNeeded(15);
      doc.setFontSize(13);
      doc.setTextColor(120, 80, 200);
      doc.text(text, margin, y);
      y += 7;
    };

    // Title
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('AI Persona Synthesis', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(12);
    doc.setTextColor(120, 120, 120);
    doc.text(channel.title || 'Channel', pageWidth / 2, y, { align: 'center' });
    y += 4;

    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Persona Summary
    if (aiPersona.persona_summary) {
      sectionTitle('Persona Summary');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(aiPersona.persona_summary, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 6;
    }

    // Writing Style
    if (aiPersona.writing_style) {
      sectionTitle('Writing Style');
      const ws = aiPersona.writing_style;
      const styleRows = [];
      if (ws.tone_description) styleRows.push(['Tone', ws.tone_description]);
      if (ws.formatting_habits) styleRows.push(['Formatting', ws.formatting_habits]);
      if (ws.language) styleRows.push(['Language', ws.language]);
      if (ws.emoji_style) styleRows.push(['Emoji Style', ws.emoji_style]);

      if (styleRows.length > 0) {
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Aspect', 'Description']],
          body: styleRows,
          styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
          headStyles: { fillColor: [120, 80, 200], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 245, 255] },
          columnStyles: { 0: { cellWidth: 30, fontStyle: 'bold' } },
        });
        y = doc.lastAutoTable.finalY + 4;
      }

      if (ws.signature_phrases && ws.signature_phrases.length > 0) {
        addPageIfNeeded(10);
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('Signature Phrases:', margin, y);
        y += 5;
        doc.setTextColor(60, 60, 60);
        ws.signature_phrases.forEach((phrase) => {
          addPageIfNeeded(6);
          const lines = doc.splitTextToSize(`"${phrase}"`, contentWidth - 5);
          doc.text(lines, margin + 3, y);
          y += lines.length * 4.5 + 2;
        });
        y += 3;
      }
    }

    // Content Templates
    if (aiPersona.content_templates && aiPersona.content_templates.length > 0) {
      sectionTitle('Content Templates');
      aiPersona.content_templates.forEach((tpl) => {
        addPageIfNeeded(25);
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.text(tpl.name || 'Template', margin, y);
        y += 5;

        if (tpl.description) {
          doc.setFontSize(9);
          doc.setTextColor(80, 80, 80);
          const descLines = doc.splitTextToSize(tpl.description, contentWidth - 5);
          doc.text(descLines, margin + 2, y);
          y += descLines.length * 4.5 + 2;
        }

        if (tpl.structure) {
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.setFillColor(245, 245, 245);
          const structLines = doc.splitTextToSize(tpl.structure, contentWidth - 10);
          const blockH = structLines.length * 4 + 4;
          addPageIfNeeded(blockH + 2);
          doc.rect(margin + 2, y - 2, contentWidth - 4, blockH, 'F');
          doc.text(structLines, margin + 5, y + 1);
          y += blockH + 2;
        }

        if (tpl.example_summary) {
          doc.setFontSize(8);
          doc.setTextColor(130, 130, 130);
          const exLines = doc.splitTextToSize(`Ex: ${tpl.example_summary}`, contentWidth - 5);
          doc.text(exLines, margin + 2, y);
          y += exLines.length * 4 + 4;
        }
        y += 2;
      });
    }

    // Content Strategy
    if (aiPersona.content_strategy) {
      sectionTitle('Content Strategy');
      const cs = aiPersona.content_strategy;

      if (cs.main_topics && cs.main_topics.length > 0) {
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('Main Topics:', margin, y);
        y += 5;
        doc.setTextColor(60, 60, 60);
        const topicsText = cs.main_topics.join('  •  ');
        const topicLines = doc.splitTextToSize(topicsText, contentWidth - 5);
        doc.text(topicLines, margin + 3, y);
        y += topicLines.length * 4.5 + 4;
      }

      if (cs.posting_sequences && cs.posting_sequences.length > 0) {
        addPageIfNeeded(10);
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('Posting Sequences:', margin, y);
        y += 5;
        doc.setTextColor(60, 60, 60);
        cs.posting_sequences.forEach((seq) => {
          addPageIfNeeded(6);
          const lines = doc.splitTextToSize(`→ ${seq}`, contentWidth - 5);
          doc.text(lines, margin + 3, y);
          y += lines.length * 4.5 + 2;
        });
        y += 3;
      }

      if (cs.weekly_pattern_analysis) {
        addPageIfNeeded(10);
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('Weekly Pattern:', margin, y);
        y += 5;
        doc.setTextColor(60, 60, 60);
        const wpLines = doc.splitTextToSize(cs.weekly_pattern_analysis, contentWidth - 5);
        doc.text(wpLines, margin + 3, y);
        y += wpLines.length * 4.5 + 4;
      }

      if (cs.promotional_vs_value_ratio) {
        addPageIfNeeded(10);
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('Promo vs Value Ratio:', margin, y);
        y += 5;
        doc.setTextColor(60, 60, 60);
        const prLines = doc.splitTextToSize(cs.promotional_vs_value_ratio, contentWidth - 5);
        doc.text(prLines, margin + 3, y);
        y += prLines.length * 4.5 + 4;
      }
    }

    // Strengths & Weaknesses
    if ((aiPersona.strengths && aiPersona.strengths.length > 0) || (aiPersona.weaknesses && aiPersona.weaknesses.length > 0)) {
      sectionTitle('Strengths & Weaknesses');

      const rows = [];
      const maxLen = Math.max(aiPersona.strengths?.length || 0, aiPersona.weaknesses?.length || 0);
      for (let i = 0; i < maxLen; i++) {
        rows.push([
          aiPersona.strengths?.[i] ? `+ ${aiPersona.strengths[i]}` : '',
          aiPersona.weaknesses?.[i] ? `- ${aiPersona.weaknesses[i]}` : '',
        ]);
      }

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Strengths', 'Weaknesses']],
        body: rows,
        styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50], overflow: 'linebreak' },
        headStyles: { fillColor: [120, 80, 200], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: contentWidth / 2 },
          1: { cellWidth: contentWidth / 2 },
        },
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    // Recommendations
    if (aiPersona.recommendations && aiPersona.recommendations.length > 0) {
      sectionTitle('Recommendations');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      aiPersona.recommendations.forEach((r, i) => {
        addPageIfNeeded(10);
        const lines = doc.splitTextToSize(`${i + 1}. ${r}`, contentWidth - 5);
        doc.text(lines, margin + 2, y);
        y += lines.length * 5 + 3;
      });
    }

    // Footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text(
        `Page ${i}/${totalPages}  —  Spy Affiliation Trading`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    }

    const filename = `persona-${(channel.title || 'channel').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    doc.save(filename);
  };

  if (loading || !persona) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const { channel, coverage, publication_rhythm, writing_style, message_structure, engagement } = persona;

  const maxHookCount = Math.max(...(message_structure.hook_types || []).map(h => h.count), 1);
  const maxCtaCount = Math.max(...(message_structure.cta_types || []).map(c => c.count), 1);
  const maxWordCount = Math.max(...(writing_style.recurring_words || []).map(w => w.count), 1);

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/channels/${id}`)}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Channel</span>
        </button>
        <button
          onClick={() => navigate(`/channels/${id}/preview`)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/10 transition-colors"
        >
          <Smartphone className="w-4 h-4" />
          Full Preview
        </button>
      </div>

      {/* Channel Header */}
      <Card>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {channel.photo_url ? (
              <img
                src={channel.photo_url}
                alt={channel.title}
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-500 font-bold text-xl">
                  {(channel.title || '?')[0].toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-zinc-100">
                {channel.title} — Persona
              </h2>
              <p className="text-emerald-500 text-sm mt-1">
                {channel.username ? `@${channel.username}` : ''}
                {' · '}
                {(channel.subscribers_count || 0).toLocaleString()} subscribers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-zinc-400">Analysis Coverage</p>
              <p className="text-lg font-bold text-zinc-100">
                {coverage.analyzed_messages}/{coverage.total_messages}
                <span className="text-sm text-zinc-500 ml-1">
                  ({coverage.analysis_pct}%)
                </span>
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* A) Publication Rhythm */}
      <CollapsibleSection title="Publication Rhythm" icon={Clock} iconColor="text-purple-500">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <p className="text-2xl font-bold text-zinc-100">{publication_rhythm.avg_posts_per_day}</p>
            <p className="text-xs text-zinc-500">Avg posts/day</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <p className="text-2xl font-bold text-zinc-100">{publication_rhythm.min_posts_per_day}</p>
            <p className="text-xs text-zinc-500">Min posts/day</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <p className="text-2xl font-bold text-zinc-100">{publication_rhythm.max_posts_per_day}</p>
            <p className="text-xs text-zinc-500">Max posts/day</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <p className="text-2xl font-bold text-zinc-100">{publication_rhythm.total_messages}</p>
            <p className="text-xs text-zinc-500">Total messages</p>
          </div>
        </div>

        {/* Posting Hours Chart */}
        {publication_rhythm.posting_hours && publication_rhythm.posting_hours.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-zinc-400 mb-3">Posting Hours Distribution</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={publication_rhythm.posting_hours}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={{ stroke: '#27272a' }}
                  tickLine={false}
                  tickFormatter={(h) => `${h}h`}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Posts" fill="#a855f7" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Active Days + Content Types */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-zinc-400 mb-3">Active Days</h4>
            <div className="space-y-2">
              {(publication_rhythm.active_days || []).map((d) => (
                <ProgressBar
                  key={d.day}
                  label={d.day}
                  value={d.count}
                  maxValue={Math.max(...publication_rhythm.active_days.map(x => x.count))}
                  color="bg-purple-500"
                />
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-zinc-400 mb-3">Content Types</h4>
            <div className="space-y-2">
              {(publication_rhythm.content_types || []).map((t) => (
                <ProgressBar
                  key={t.type}
                  label={`${t.type} (${t.pct}%)`}
                  value={t.count}
                  maxValue={Math.max(...publication_rhythm.content_types.map(x => x.count))}
                  color="bg-cyan-500"
                />
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* B) Writing Style */}
      <CollapsibleSection title="Writing Style" icon={Type} iconColor="text-amber-500">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <p className="text-2xl font-bold text-zinc-100">{writing_style.avg_message_length}</p>
            <p className="text-xs text-zinc-500">Avg msg length (chars)</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <p className="text-2xl font-bold text-zinc-100">{writing_style.median_message_length}</p>
            <p className="text-xs text-zinc-500">Median msg length</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <p className="text-2xl font-bold text-zinc-100">{writing_style.emoji_per_message}</p>
            <p className="text-xs text-zinc-500">Emojis / message</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <p className="text-2xl font-bold text-zinc-100">{writing_style.messages_with_emojis_pct}%</p>
            <p className="text-xs text-zinc-500">With emojis</p>
          </div>
        </div>

        {/* Recurring Words */}
        <h4 className="text-sm font-medium text-zinc-400 mb-3">Top Recurring Words</h4>
        <div className="flex flex-wrap gap-2">
          {(writing_style.recurring_words || []).map((w) => {
            const ratio = w.count / maxWordCount;
            let sizeClass = 'text-sm';
            if (ratio > 0.8) sizeClass = 'text-xl font-bold';
            else if (ratio > 0.6) sizeClass = 'text-lg font-semibold';
            else if (ratio > 0.4) sizeClass = 'text-base font-medium';
            else if (ratio > 0.2) sizeClass = 'text-sm font-normal';
            return (
              <span
                key={w.word}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-zinc-800/60 ${sizeClass} text-zinc-300`}
              >
                {w.word}
                <span className="text-xs text-zinc-500">{w.count}</span>
              </span>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* C) Message Structure */}
      <CollapsibleSection title="Message Structure" icon={Target} iconColor="text-emerald-500">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <p className="text-2xl font-bold text-zinc-100">{message_structure.total_analyzed}</p>
            <p className="text-xs text-zinc-500">Messages analyzed</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <p className="text-2xl font-bold text-emerald-400">{message_structure.avg_engagement}/10</p>
            <p className="text-xs text-zinc-500">Avg engagement</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <p className="text-2xl font-bold text-cyan-400">{message_structure.avg_virality}/10</p>
            <p className="text-xs text-zinc-500">Avg virality</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Hook Types */}
          <div>
            <h4 className="text-sm font-medium text-zinc-400 mb-3">Hook Types</h4>
            <div className="space-y-2">
              {(message_structure.hook_types || []).map((h) => (
                <ProgressBar
                  key={h.type}
                  label={h.type}
                  value={h.count}
                  maxValue={maxHookCount}
                  color="bg-emerald-500"
                />
              ))}
              {(!message_structure.hook_types || message_structure.hook_types.length === 0) && (
                <p className="text-sm text-zinc-500">No hook data yet</p>
              )}
            </div>
          </div>

          {/* CTA Types */}
          <div>
            <h4 className="text-sm font-medium text-zinc-400 mb-3">CTA Types</h4>
            <div className="space-y-2">
              {(message_structure.cta_types || []).map((c) => (
                <ProgressBar
                  key={c.type}
                  label={c.type}
                  value={c.count}
                  maxValue={maxCtaCount}
                  color="bg-cyan-500"
                />
              ))}
              {(!message_structure.cta_types || message_structure.cta_types.length === 0) && (
                <p className="text-sm text-zinc-500">No CTA data yet</p>
              )}
            </div>
          </div>

          {/* Tones */}
          <div>
            <h4 className="text-sm font-medium text-zinc-400 mb-3">Tone Distribution</h4>
            <div className="space-y-2">
              {(message_structure.tones || []).map((t) => (
                <div key={t.type} className="flex items-center justify-between">
                  <Badge variant={t.type}>{t.type}</Badge>
                  <span className="text-sm text-zinc-400">{t.pct}%</span>
                </div>
              ))}
              {(!message_structure.tones || message_structure.tones.length === 0) && (
                <p className="text-sm text-zinc-500">No tone data yet</p>
              )}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* E) Engagement Results */}
      <CollapsibleSection title="Engagement Results" icon={TrendingUp} iconColor="text-rose-500">
        {/* Hour vs Views Correlation */}
        {engagement.hour_views_correlation && engagement.hour_views_correlation.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-zinc-400 mb-3">Views by Posting Hour</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={engagement.hour_views_correlation}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={{ stroke: '#27272a' }}
                  tickLine={false}
                  tickFormatter={(h) => `${h}h`}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="avg_views" name="Avg Views" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Best Performing Types */}
        {engagement.best_performing_types && engagement.best_performing_types.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-zinc-400 mb-3">Best Performing Content Types</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {engagement.best_performing_types.map((t) => (
                <div key={t.type} className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-sm font-medium text-zinc-300 capitalize">{t.type}</p>
                  <p className="text-lg font-bold text-zinc-100">
                    {Number(t.avg_views).toLocaleString()}
                  </p>
                  <p className="text-xs text-zinc-500">avg views ({t.count} msgs)</p>
                  {t.avg_engagement && (
                    <p className="text-xs text-emerald-400 mt-1">
                      Engagement: {t.avg_engagement}/10
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top 10 Messages */}
        <h4 className="text-sm font-medium text-zinc-400 mb-3">Top 10 Messages by Views</h4>
        <div className="space-y-2">
          {(engagement.top_messages || []).map((m, i) => (
            <div
              key={i}
              className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-800"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-500">#{i + 1}</span>
                  {m.hook_type && <Badge variant={m.hook_type}>{m.hook_type}</Badge>}
                  <span className="text-xs text-zinc-500 capitalize">{m.content_type}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-rose-400 font-medium">
                    {(m.views || 0).toLocaleString()} views
                  </span>
                  {m.engagement_score && (
                    <span className="text-emerald-400">
                      {m.engagement_score}/10
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-zinc-300 line-clamp-2">
                {m.text_preview || 'No text content'}
              </p>
              {m.posted_at && (
                <p className="text-xs text-zinc-600 mt-1">
                  {new Date(m.posted_at).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* AI Persona Synthesis */}
      <CollapsibleSection title="AI Persona Synthesis" icon={Sparkles} iconColor="text-violet-500" defaultOpen={true}>
        {!aiPersona ? (
          <div className="text-center py-8">
            <p className="text-zinc-400 mb-4">
              Generate an AI-powered persona analysis using Claude.
              This will analyze writing style, content templates, strategy, and provide recommendations.
            </p>
            <button
              onClick={generateAiPersona}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate AI Persona
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={exportPersonaToPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-violet-400 hover:text-violet-300 border border-violet-500/30 rounded-lg hover:bg-violet-500/10 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <button
                onClick={generateAiPersona}
                disabled={aiLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Regenerate
              </button>
            </div>

            {/* Persona Summary */}
            {aiPersona.persona_summary && (
              <div>
                <h4 className="text-sm font-medium text-violet-400 mb-2">Persona Summary</h4>
                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">
                  {aiPersona.persona_summary}
                </p>
              </div>
            )}

            {/* Writing Style */}
            {aiPersona.writing_style && (
              <div>
                <h4 className="text-sm font-medium text-violet-400 mb-2">Writing Style</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {aiPersona.writing_style.tone_description && (
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Tone</p>
                      <p className="text-sm text-zinc-300">{aiPersona.writing_style.tone_description}</p>
                    </div>
                  )}
                  {aiPersona.writing_style.formatting_habits && (
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Formatting</p>
                      <p className="text-sm text-zinc-300">{aiPersona.writing_style.formatting_habits}</p>
                    </div>
                  )}
                  {aiPersona.writing_style.language && (
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Language</p>
                      <p className="text-sm text-zinc-300">{aiPersona.writing_style.language}</p>
                    </div>
                  )}
                  {aiPersona.writing_style.emoji_style && (
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Emoji Style</p>
                      <p className="text-sm text-zinc-300">{aiPersona.writing_style.emoji_style}</p>
                    </div>
                  )}
                </div>
                {aiPersona.writing_style.signature_phrases && aiPersona.writing_style.signature_phrases.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-zinc-500 mb-2">Signature Phrases</p>
                    <div className="flex flex-wrap gap-2">
                      {aiPersona.writing_style.signature_phrases.map((phrase, i) => (
                        <span key={i} className="px-3 py-1 rounded-full bg-violet-500/10 text-violet-300 text-sm border border-violet-500/20">
                          {phrase}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Content Templates */}
            {aiPersona.content_templates && aiPersona.content_templates.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-violet-400 mb-2">Content Templates</h4>
                <div className="space-y-3">
                  {aiPersona.content_templates.map((tpl, i) => (
                    <div key={i} className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-800">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-zinc-200">{tpl.name}</span>
                      </div>
                      <p className="text-sm text-zinc-400 mb-1">{tpl.description}</p>
                      <div className="mt-2 p-2 bg-zinc-900 rounded text-xs text-zinc-300 font-mono">
                        {tpl.structure}
                      </div>
                      {tpl.example_summary && (
                        <p className="text-xs text-zinc-500 mt-2 italic">{tpl.example_summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Strategy */}
            {aiPersona.content_strategy && (
              <div>
                <h4 className="text-sm font-medium text-violet-400 mb-2">Content Strategy</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {aiPersona.content_strategy.main_topics && (
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-2">Main Topics</p>
                      <div className="flex flex-wrap gap-1.5">
                        {aiPersona.content_strategy.main_topics.map((topic, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-zinc-700 text-xs text-zinc-300">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiPersona.content_strategy.posting_sequences && (
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-2">Posting Sequences</p>
                      <ul className="space-y-1">
                        {aiPersona.content_strategy.posting_sequences.map((seq, i) => (
                          <li key={i} className="text-sm text-zinc-300 flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-amber-500 flex-shrink-0" />
                            {seq}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {aiPersona.content_strategy.weekly_pattern_analysis && (
                  <div className="mt-3 bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-xs text-zinc-500 mb-1">Weekly Pattern</p>
                    <p className="text-sm text-zinc-300">{aiPersona.content_strategy.weekly_pattern_analysis}</p>
                  </div>
                )}
                {aiPersona.content_strategy.promotional_vs_value_ratio && (
                  <div className="mt-3 bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-xs text-zinc-500 mb-1">Promotional vs Value Ratio</p>
                    <p className="text-sm text-zinc-300">{aiPersona.content_strategy.promotional_vs_value_ratio}</p>
                  </div>
                )}
              </div>
            )}

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiPersona.strengths && aiPersona.strengths.length > 0 && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-emerald-400 mb-2">Strengths</h4>
                  <ul className="space-y-1.5">
                    {aiPersona.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">+</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {aiPersona.weaknesses && aiPersona.weaknesses.length > 0 && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-rose-400 mb-2">Weaknesses</h4>
                  <ul className="space-y-1.5">
                    {aiPersona.weaknesses.map((w, i) => (
                      <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                        <span className="text-rose-500 mt-0.5">-</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Recommendations */}
            {aiPersona.recommendations && aiPersona.recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-violet-400 mb-2">Recommendations</h4>
                <div className="space-y-2">
                  {aiPersona.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg">
                      <span className="text-violet-400 font-bold text-sm mt-0.5">{i + 1}.</span>
                      <p className="text-sm text-zinc-300">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* 30-Day Content Plan */}
      <CollapsibleSection title="30-Day Content Plan" icon={Calendar} iconColor="text-amber-500" defaultOpen={true}>
        {!plan ? (
          <div className="text-center py-8">
            <p className="text-zinc-400 mb-4">
              Generate a complete 30-day content plan based on this channel's persona,
              best hooks, optimal posting times, and top-performing content.
            </p>
            <button
              onClick={generatePlan}
              disabled={planLoading}
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
            >
              {planLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating plan...
                </>
              ) : (
                <>
                  <Calendar className="w-5 h-5" />
                  Generate 30-Day Plan
                </>
              )}
            </button>
            {planError && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
                {planError}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={exportPlanToPdf}
                disabled={pdfLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 disabled:opacity-50 transition-colors"
              >
                {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {pdfLoading ? 'Generating...' : 'Export PDF'}
              </button>
              <button
                onClick={generatePlan}
                disabled={planLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {planLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Regenerate
              </button>
            </div>

            {/* Plan Summary */}
            {plan.plan_summary && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-amber-400 mb-2">Strategy Overview</h4>
                <p className="text-sm text-zinc-300 leading-relaxed">{plan.plan_summary}</p>
              </div>
            )}

            {/* Weekly Themes */}
            {plan.weekly_themes && plan.weekly_themes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-amber-400 mb-3">Weekly Themes</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {plan.weekly_themes.map((w) => (
                    <div key={w.week} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-800">
                      <p className="text-xs text-amber-400 font-medium">Week {w.week}</p>
                      <p className="text-sm font-medium text-zinc-200 mt-1">{w.theme}</p>
                      <p className="text-xs text-zinc-500 mt-1">{w.focus}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily Plan */}
            {plan.daily_plan && plan.daily_plan.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-amber-400 mb-3">
                  Daily Schedule ({plan.daily_plan.length} days)
                </h4>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                  {plan.daily_plan.map((day) => (
                    <DayPlanCard key={day.day} day={day} />
                  ))}
                </div>
              </div>
            )}

            {/* KPIs */}
            {plan.kpis && plan.kpis.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-amber-400 mb-2">KPIs to Track</h4>
                <div className="flex flex-wrap gap-2">
                  {plan.kpis.map((kpi, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 text-sm border border-amber-500/20">
                      {kpi}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>
      </div>

      {/* Right sidebar: Mini phone preview */}
      <div className="hidden xl:block w-[310px] flex-shrink-0">
        <div className="sticky top-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-3 text-center">Channel Feed</h3>
          <MiniPhonePreview
            channelId={id}
            channelName={channel.title}
            subscriberCount={channel.subscribers_count}
          />
        </div>
      </div>
    </div>
  );
}

function DayPlanCard({ day }) {
  const [expanded, setExpanded] = useState(false);
  const posts = day.posts || [];

  return (
    <div className="bg-zinc-800/30 rounded-lg border border-zinc-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-amber-400 w-10">J{day.day}</span>
          <span className="text-sm text-zinc-400">{day.day_of_week || day.dow}</span>
          <span className="text-xs text-zinc-600">{posts.length} post{posts.length > 1 ? 's' : ''}</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {posts.map((post, i) => (
            <div key={i} className="bg-zinc-900/50 rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-zinc-400">{post.time}</span>
                <Badge variant={post.type || 'text'}>{post.type || 'text'}</Badge>
                {post.hook_type && <Badge variant={post.hook_type}>{post.hook_type}</Badge>}
              </div>
              <p className="text-sm text-zinc-300">{post.content_brief || post.topic}</p>
              {post.cta && (
                <p className="text-xs text-cyan-400 mt-1">CTA: {post.cta}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
