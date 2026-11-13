import { useEffect, useState } from 'react';
import { Send, ShieldAlert, X } from 'lucide-react';
import { DisasterId, LevelSummary } from '../game/types';

interface AICoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDisaster?: DisasterId | 'general';
  runSummary?: Omit<LevelSummary, 'newlyUnlockedAchievements'> | null;
}

const QUICK_PROMPTS: { label: string; disaster: DisasterId | 'general'; question: string }[] = [
  {
    label: 'Earthquake: Drop, Cover & Hold On',
    disaster: 'earthquake',
    question: 'Why is Drop, Cover, and Hold On safer than running outside during an earthquake?',
  },
  {
    label: 'Flood: Vehicle & Power Hazards',
    disaster: 'flood',
    question: 'Why should you never drive into floodwater or walk near downed utility poles?',
  },
  {
    label: 'Fire: Smoke & Stairwell Rules',
    disaster: 'fire',
    question: 'Why should I stay low under smoke, check closed doors for heat, and avoid elevators?',
  },
];

export function AICoachModal({
  isOpen,
  onClose,
  initialDisaster = 'general',
  runSummary = null,
}: AICoachModalProps) {
  const [question, setQuestion] = useState('');
  const [disaster, setDisaster] = useState<DisasterId | 'general'>(initialDisaster);
  const [reply, setReply] = useState('');
  const [source, setSource] = useState<'gemini' | 'offline-guide' | ''>('');
  const [loading, setLoading] = useState(false);

  const askCoach = async (customQuestion?: string, customDisaster?: DisasterId | 'general', includeSummary = false) => {
    setLoading(true);
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: customQuestion ?? question,
          disaster: customDisaster ?? disaster,
          runSummary: includeSummary ? runSummary : undefined,
        }),
      });
      const data = await res.json();
      setReply(data.reply || 'Stay calm, follow official safety protocols, and prioritize life safety over property.');
      setSource(data.source || 'offline-guide');
    } catch {
      setReply(
        'Preparedness Guide: During earthquakes Drop, Cover, and Hold On. During floods move to high ground and avoid water and power lines. During fires stay low under smoke, check doors for heat, and use stairs.'
      );
      setSource('offline-guide');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setDisaster(initialDisaster);
    if (runSummary) {
      askCoach('Debrief my survival run and highlight key safety lessons.', runSummary.disaster, true);
    } else {
      setReply('');
      setSource('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, runSummary, initialDisaster]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Disaster Safety Coach"
    >
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700/80 bg-[#0d1523]/95 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div className="flex items-center gap-3.5">
            <ShieldAlert className="h-7 w-7 text-orange-400 shrink-0" />
            <div>
              <h2 className="font-display text-[30px] sm:text-[36px] font-extrabold tracking-wide text-slate-50 leading-none">
                Disaster Safety Coach
              </h2>
              <p className="text-sm sm:text-base text-slate-300 mt-1">
                Performance debrief &amp; emergency preparedness guidance
                {source === 'gemini' ? ' · AI Powered' : source === 'offline-guide' ? ' · Built-in Safety Guide' : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close coach"
            className="rounded-xl p-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2.5">
            {(['general', 'earthquake', 'flood', 'fire'] as const).map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => setDisaster(topic)}
                className={`px-4 py-2 rounded-xl text-sm sm:text-base font-bold capitalize transition-colors whitespace-nowrap shrink-0 ${
                  disaster === topic
                    ? 'bg-orange-500 text-slate-950'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {topic === 'general' ? 'All Disasters' : topic}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            <p className="text-sm font-bold text-slate-300">Quick Safety Questions</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.label}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setDisaster(qp.disaster);
                    setQuestion(qp.question);
                    askCoach(qp.question, qp.disaster, false);
                  }}
                  className="text-left rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 text-sm sm:text-base font-semibold text-slate-100 hover:border-orange-500/70 hover:bg-slate-800 transition-colors"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#070c14] p-5 min-h-[190px]">
            {loading ? (
              <div className="flex items-center justify-center h-36 text-lg font-medium text-slate-300">
                Analyzing safety protocol and survival data...
              </div>
            ) : reply ? (
              <div className="whitespace-pre-line text-[18px] sm:text-[19px] leading-relaxed text-slate-100">
                {reply}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-36 text-center text-[18px] text-slate-300">
                Ask any question about Earthquake, Flood, or Fire survival below, or select a quick prompt above.
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!question.trim() || loading) return;
            askCoach(question.trim(), disaster, Boolean(runSummary));
          }}
          className="border-t border-slate-800 p-4 sm:p-5 bg-[#0a101b] flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about earthquake cover, flood safety, fire exits..."
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-base sm:text-lg text-slate-100 placeholder-slate-400 focus:border-orange-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-base sm:text-lg font-bold text-slate-950 hover:bg-orange-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="h-5 w-5" />
            <span>Ask Coach</span>
          </button>
        </form>
      </div>
    </div>
  );
}
