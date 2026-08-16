'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Download,
  Loader2,
  RefreshCw,
  Scale,
  Shuffle,
  Users,
  X,
} from 'lucide-react';
import type { Participant, RostersMap, WeeklyAllocationMetadata } from '@/lib/types';
import type { FairRosterMode } from '@/lib/fairRoster';
import { getCurrentSundayISO, getWeekLabel, normalizeToSundayISO } from '@/lib/rosterCalendar';

export interface GeneratorMemberSummary {
  memberId: string;
  name: string;
  weeklyPoints: number;
  targetPoints: number;
  deviation: number;
  assignmentCount: number;
  cookingTurns: number;
  cleaningTurns: number;
}

export interface RosterGeneratorPreview {
  mode: FairRosterMode;
  rosters: RostersMap;
  allocation: WeeklyAllocationMetadata;
  memberSummaries: GeneratorMemberSummary[];
  fairnessIndex: number;
  loadRange: number;
  warnings: string[];
}

interface RosterGeneratorModalProps {
  isOpen: boolean;
  participants: Participant[];
  onClose: () => void;
  onGenerate: (input: {
    availableMembers: Participant[];
    weekStart: string;
    seed: string;
    mode: FairRosterMode;
  }) => Promise<RosterGeneratorPreview> | RosterGeneratorPreview;
  onApply: (preview: RosterGeneratorPreview, weekStart: string) => void;
  onDownloadPreview?: (preview: RosterGeneratorPreview, weekStart: string) => void;
}

function createSeed(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeWeekLabel(value: string): string {
  try {
    return getWeekLabel(value);
  } catch {
    return 'Choose a valid week date';
  }
}

export default function RosterGeneratorModal({
  isOpen,
  participants,
  onClose,
  onGenerate,
  onApply,
  onDownloadPreview,
}: RosterGeneratorModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(participants.map((participant) => participant.id)),
  );
  const [weekStart, setWeekStart] = useState(() => getCurrentSundayISO());
  const [mode, setMode] = useState<FairRosterMode>('weighted');
  const [preview, setPreview] = useState<RosterGeneratorPreview | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isGenerating) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isGenerating, isOpen, onClose]);

  const availableMembers = useMemo(
    () => participants.filter((participant) => selectedIds.has(participant.id)),
    [participants, selectedIds],
  );

  if (!isOpen) return null;

  const toggleParticipant = (participantId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(participantId)) next.delete(participantId);
      else next.add(participantId);
      return next;
    });
    setPreview(null);
    setError(null);
  };

  const runGeneration = async () => {
    if (availableMembers.length < 5) {
      setError('Select at least five available members. The weekly cooking rotation needs unique teams and a rest day between cooking shifts.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const normalizedWeek = normalizeToSundayISO(weekStart);
      setWeekStart(normalizedWeek);
      const result = await onGenerate({
        availableMembers,
        weekStart: normalizedWeek,
        seed: createSeed(),
        mode,
      });
      setPreview(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to generate a fair roster.');
    } finally {
      setIsGenerating(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isGenerating) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="roster-generator-title"
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--card-border)] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-[var(--nysc-green)]/10 p-2.5 text-[var(--nysc-green)]">
              <Scale className="h-5 w-5" />
            </span>
            <div>
              <h2 id="roster-generator-title" className="text-lg font-black text-[var(--nysc-green)]">
                Share Weekly Work Fairly
              </h2>
              <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                Select only the members who will be available. Glorious Service is never changed.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            aria-label="Close fair roster generator"
            className="rounded-full p-1.5 text-[var(--text-muted)] hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          <section className="space-y-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-[var(--text-muted)]">
              Balancing method
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={mode === 'weighted'}
                onClick={() => {
                  setMode('weighted');
                  setPreview(null);
                  setError(null);
                }}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  mode === 'weighted'
                    ? 'border-[var(--nysc-green)] bg-[var(--nysc-green)]/10'
                    : 'border-[var(--card-border)] bg-[var(--bg-page)] opacity-70'
                }`}
              >
                <span className="block text-xs font-black text-[var(--text-primary)]">Effort-balanced</span>
                <span className="mt-1 block text-[10px] font-semibold leading-relaxed text-[var(--text-muted)]">
                  Uses time and effort points, so heavier duties reduce a person’s remaining load.
                </span>
              </button>
              <button
                type="button"
                aria-pressed={mode === 'appearances'}
                onClick={() => {
                  setMode('appearances');
                  setPreview(null);
                  setError(null);
                }}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  mode === 'appearances'
                    ? 'border-[var(--nysc-green)] bg-[var(--nysc-green)]/10'
                    : 'border-[var(--card-border)] bg-[var(--bg-page)] opacity-70'
                }`}
              >
                <span className="block text-xs font-black text-[var(--text-primary)]">Equal appearances</span>
                <span className="mt-1 block text-[10px] font-semibold leading-relaxed text-[var(--text-muted)]">
                  Counts every assigned position once, regardless of duration or effort.
                </span>
              </button>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[var(--text-muted)]">
                <CalendarDays className="h-3.5 w-3.5" /> Week beginning Sunday
              </span>
              <input
                type="date"
                value={weekStart}
                onChange={(event) => {
                  setWeekStart(event.target.value);
                  setPreview(null);
                  setError(null);
                }}
                onBlur={() => {
                  try {
                    setWeekStart(normalizeToSundayISO(weekStart));
                  } catch {
                    // Generation presents the actionable validation message.
                  }
                }}
                className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg-page)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--nysc-green)]"
              />
            </label>
            <div className="rounded-xl bg-[var(--nysc-green)]/10 px-3 py-2.5 text-xs font-extrabold text-[var(--nysc-green)]">
              {safeWeekLabel(weekStart)}
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-black text-[var(--text-primary)]">
                  <Users className="h-4 w-4 text-[var(--nysc-green)]" /> Available members
                </h3>
                <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                  {availableMembers.length} of {participants.length} selected
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds(new Set(participants.map((participant) => participant.id)));
                    setPreview(null);
                  }}
                  className="text-[11px] font-extrabold text-[var(--nysc-green)] hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds(new Set());
                    setPreview(null);
                  }}
                  className="text-[11px] font-extrabold text-red-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {participants.map((participant) => {
                const selected = selectedIds.has(participant.id);
                return (
                  <button
                    key={participant.id}
                    type="button"
                    onClick={() => toggleParticipant(participant.id)}
                    aria-pressed={selected}
                    className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                      selected
                        ? 'border-[var(--nysc-green)] bg-[var(--nysc-green)]/10 text-[var(--text-primary)]'
                        : 'border-[var(--card-border)] bg-[var(--bg-page)] text-[var(--text-muted)] opacity-65'
                    }`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      selected ? 'border-[var(--nysc-green)] bg-[var(--nysc-green)] text-white' : 'border-current'
                    }`}>
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate">{participant.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] font-medium text-[var(--text-muted)]">
              Choose at least five people. Cooking teams never repeat; within prayer, cleaning, and cooking, each person gets a day off before the next duty.
            </p>
          </section>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-bold text-red-600 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {preview && (
            <section className="space-y-3 rounded-2xl border border-[var(--nysc-green)]/30 bg-[var(--nysc-green)]/5 p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-[var(--nysc-green)]">Fairness preview</h3>
                  <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                    Index {(preview.fairnessIndex * 100).toFixed(1)}% · {preview.mode === 'appearances'
                      ? `appearance spread ${preview.loadRange.toFixed(0)}`
                      : `load spread ${preview.loadRange.toFixed(2)} points`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--card-bg)] px-3 py-1 text-[10px] font-black text-[var(--text-muted)] shadow-sm">
                    Cooking: Sunday 1 · Mon–Sat 2
                  </span>
                  {onDownloadPreview && (
                    <button
                      type="button"
                      onClick={() => onDownloadPreview(preview, normalizeToSundayISO(weekStart))}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1 text-[10px] font-black text-[var(--nysc-green)] shadow-sm hover:bg-[var(--nysc-green)]/10"
                    >
                      <Download className="h-3.5 w-3.5" /> Download poster
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {[...preview.memberSummaries]
                  .sort((a, b) => b.weeklyPoints - a.weeklyPoints || a.name.localeCompare(b.name))
                  .map((member) => (
                    <div key={member.memberId} className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-xs font-black text-[var(--text-primary)]">{member.name}</span>
                        <span className="shrink-0 text-xs font-black text-[var(--nysc-green)]">
                          {preview.mode === 'appearances'
                            ? `${member.weeklyPoints.toFixed(0)} appearances`
                            : `${member.weeklyPoints.toFixed(2)} pts`}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-semibold text-[var(--text-muted)]">
                        Target {member.targetPoints.toFixed(2)} · {member.assignmentCount} position(s) · {member.cookingTurns} cooking · {member.cleaningTurns} cleaning
                      </p>
                    </div>
                  ))}
              </div>

              {preview.warnings.length > 0 && (
                <div className="space-y-1 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  {preview.warnings.map((warning) => <p key={warning}>• {warning}</p>)}
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--card-border)] p-4 sm:px-5">
          <p className="max-w-sm text-[10px] font-medium text-[var(--text-muted)]">
            {mode === 'appearances'
              ? 'Every non-Glorious assignment position counts once, including Discussion and Game Night.'
              : 'Discussion and Game Night carry zero points.'}{' '}
            Applying creates an editable draft; it does not publish automatically.
          </p>
          <div className="flex gap-2">
            {preview && (
              <button
                type="button"
                onClick={() => void runGeneration()}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] px-3.5 py-2 text-xs font-extrabold text-[var(--text-primary)] hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} /> Reroll
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (preview) onApply(preview, normalizeToSundayISO(weekStart));
                else void runGeneration();
              }}
              disabled={isGenerating || availableMembers.length < 5}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--nysc-green)] px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Balancing…</>
              ) : preview ? (
                <><Check className="h-4 w-4" /> Apply Draft</>
              ) : (
                <><Shuffle className="h-4 w-4" /> Generate</>
              )}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
