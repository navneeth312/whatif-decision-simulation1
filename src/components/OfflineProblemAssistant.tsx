import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import {
  AlternativeRunRecord,
  ProblemStatement,
  Scenario
} from '../types';
import {
  DiagnosedProblem,
  FutureIssueOutcome
} from '../models/decisionEngines';
import {
  answerOfflineProblemQuestion,
  OfflineProblemAssistantContext
} from '../models/offlineProblemAssistant';

interface OfflineProblemAssistantProps {
  scenario: Scenario;
  activeProblem?: ProblemStatement;
  baselineResult: AlternativeRunRecord;
  selectedResult: AlternativeRunRecord;
  alternatives: AlternativeRunRecord[];
  baselineProblems: DiagnosedProblem[];
  futureOutcomes: FutureIssueOutcome[];
  onClose: () => void;
}

interface AssistantMessage {
  role: 'assistant' | 'user';
  text: string;
}

const SUGGESTED_QUESTIONS = [
  'What is happening now?',
  'Which solution passes the limits?',
  'What could happen later?'
];

export const OfflineProblemAssistant: React.FC<OfflineProblemAssistantProps> = (props) => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const context: OfflineProblemAssistantContext = props;

  useEffect(() => {
    setQuestion('');
    setMessages([{
      role: 'assistant',
      text: 'Ask about the selected problem, measured issues, tested solutions, or future stress cases. I answer from this scenario and its solver results; no cloud AI is called.'
    }]);
  }, [props.scenario.id, props.activeProblem?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const submitQuestion = (value: string) => {
    const cleanQuestion = value.trim().slice(0, 500);
    if (!cleanQuestion) return;
    const answer = answerOfflineProblemQuestion(cleanQuestion, context);
    setMessages((current) => [
      ...current,
      { role: 'user' as const, text: cleanQuestion },
      { role: 'assistant' as const, text: answer }
    ].slice(-13));
    setQuestion('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitQuestion(question);
  };

  return (
    <section
      id="offline-assistant-panel"
      className="rounded-2xl border border-cyan-500/25 bg-slate-950/80 shadow-[0_20px_60px_rgba(2,8,23,0.35)]"
      aria-labelledby="offline-assistant-title"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-2 text-cyan-200">
            <Bot className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="offline-assistant-title" className="flex items-center gap-2 text-sm font-bold text-white">
              Ask WhatIf
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-200">
                Offline
              </span>
            </h2>
            <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
              Grounded in the selected problem, local catalog, and calculated solver results.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close Ask WhatIf assistant"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div
          className="max-h-64 space-y-3 overflow-y-auto pr-1"
          role="log"
          aria-label="WhatIf assistant conversation"
          aria-live="polite"
        >
          {messages.map((message, index) => (
            <div
              key={index}
              className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div className={
                'max-w-[94%] rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed whitespace-pre-wrap ' +
                (message.role === 'user'
                  ? 'border-indigo-400/25 bg-indigo-500/10 text-indigo-50'
                  : 'border-slate-800 bg-slate-900/80 text-slate-200')
              }>
                {message.role === 'assistant' && (
                  <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-cyan-300">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Solver-grounded answer
                  </div>
                )}
                {message.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => submitQuestion(suggestion)}
                className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[9px] font-semibold text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-100"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <label className="sr-only" htmlFor="offline-assistant-question">Ask about this problem</label>
          <textarea
            id="offline-assistant-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value.slice(0, 500))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submitQuestion(question);
              }
            }}
            maxLength={500}
            rows={2}
            placeholder="Ask about this problem…"
            className="min-h-10 flex-1 resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/15"
          />
          <button
            type="submit"
            disabled={!question.trim()}
            aria-label="Send question"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3 text-[10px] font-bold text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Ask
          </button>
        </form>
        <p className="flex items-center gap-1.5 text-[9px] text-slate-500">
          <MessageCircle className="h-3 w-3" aria-hidden="true" />
          Offline guide, not a generative AI model. It does not make up unmodeled results.
        </p>
      </div>
    </section>
  );
};
