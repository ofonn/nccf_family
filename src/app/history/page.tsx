'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import ConfirmModal from '@/components/ConfirmModal';
import { WeeklySnapshot, RostersMap } from '@/lib/types';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/themeContext';
import { useToast } from '@/lib/toastContext';
import { useRosters } from '@/lib/rostersContext';
import {
  History,
  RotateCcw,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Loader2,
  Sparkles,
  ShieldAlert
} from 'lucide-react';

export default function HistoryPage() {
  const { authRole, authPassword } = useAuth();
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const { refreshRosters } = useRosters();

  const [snapshots, setSnapshots] = useState<WeeklySnapshot[]>([]);
  const [hasPreviousSave, setHasPreviousSave] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);

  const [activeModal, setActiveModal] = useState<{
    type: 'rollback' | 'apply_snapshot';
    targetSnapshot?: WeeklySnapshot;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/history', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      if (data.snapshots) setSnapshots(data.snapshots);
      setHasPreviousSave(Boolean(data.previousSave));
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleRollback = async () => {
    if (!authPassword || authRole === 'none') return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authPassword,
        },
        body: JSON.stringify({ action: 'rollback' }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Successfully reverted live schedule to previous save!', 'success');
        await refreshRosters();
        await fetchHistory();
      } else {
        showToast(data.error || 'Failed to revert schedule.', 'error');
      }
    } catch (err) {
      showToast('Error connecting to server.', 'error');
    } finally {
      setIsProcessing(false);
      setActiveModal(null);
    }
  };

  const handleApplySnapshot = async (snapshot: WeeklySnapshot) => {
    if (!authPassword || authRole === 'none') return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authPassword,
        },
        body: JSON.stringify({ action: 'apply_snapshot', snapshotId: snapshot.id }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Applied ${snapshot.weekLabel} schedule to live board!`, 'success');
        await refreshRosters();
        await fetchHistory();
      } else {
        showToast(data.error || 'Failed to apply snapshot.', 'error');
      }
    } catch (err) {
      showToast('Error connecting to server.', 'error');
    } finally {
      setIsProcessing(false);
      setActiveModal(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-3.5 py-6 space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-[var(--nysc-green)]" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[var(--nysc-green)] tracking-tight flex items-center gap-2">
                <History className="w-5 h-5" />
                Roster Weekly Archives & History
              </h1>
              <p className="text-[11px] text-[var(--text-muted)] font-medium">
                Weekly schedule archives & live recovery controls
              </p>
            </div>
          </div>
        </div>

        {/* Quick Admin Recovery Panel */}
        {authRole !== 'none' && (
          <div className="p-4 rounded-2xl border border-[var(--nysc-gold)]/40 bg-[var(--nysc-gold)]/10 dark:bg-[var(--nysc-gold)]/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[var(--nysc-gold)]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--nysc-gold)]">
                  Live Schedule Recovery
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                Admin Controls
              </span>
            </div>

            <p className="text-xs text-[var(--text-muted)] font-medium">
              Need to undo recent changes? You can instantly revert the live schedule board to whatever was saved right before the last publication.
            </p>

            <button
              onClick={() => setActiveModal({ type: 'rollback' })}
              disabled={!hasPreviousSave || isProcessing}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm transition-all ${
                hasPreviousSave && !isProcessing
                  ? 'bg-[var(--nysc-green)] hover:opacity-90 active:scale-95'
                  : 'bg-gray-400 opacity-40 cursor-not-allowed'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isProcessing ? 'Reverting...' : 'Revert Live Schedule to Previous Save'}</span>
            </button>
          </div>
        )}

        {/* Weekly Roster Archives List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[var(--foreground)] uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--nysc-green)]" />
              Weekly Roster Archives
            </h2>
            <span className="text-[11px] text-[var(--text-muted)] font-semibold">
              {snapshots.length} week(s) archived
            </span>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--nysc-green)]">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                Loading Roster History...
              </p>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-12 p-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] space-y-2">
              <Sparkles className="w-8 h-8 mx-auto text-[var(--nysc-gold)]" />
              <h3 className="text-sm font-bold text-[var(--foreground)]">No History Snapshots Yet</h3>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                Weekly schedule archives are captured automatically at the start of each week and saved into the archive.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {snapshots.map((snapshot) => {
                const isExpanded = expandedSnapshotId === snapshot.id;
                return (
                  <div
                    key={snapshot.id}
                    className="border border-[var(--card-border)] bg-[var(--card-bg)]/90 rounded-2xl overflow-hidden shadow-sm transition-all"
                  >
                    {/* Snapshot Row Header */}
                    <div className="p-4 flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[var(--nysc-green)]/10 text-[var(--nysc-green)] font-black text-xs">
                          {snapshot.weekId}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                              {snapshot.weekLabel}
                            </h3>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--nysc-green)]/15 text-[var(--nysc-green)]">
                              <CheckCircle2 className="w-3 h-3" />
                              Official Weekly Roster
                            </span>
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)] font-medium">
                            Created: {new Date(snapshot.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Expand / Collapse Preview Button */}
                        <button
                          onClick={() => setExpandedSnapshotId(isExpanded ? null : snapshot.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--card-border)] text-xs font-bold text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                        >
                          <span>{isExpanded ? 'Hide Schedule' : 'View Schedule'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {/* Apply Snapshot to Live Board Button (Admins only) */}
                        {authRole !== 'none' && (
                          <button
                            onClick={() => setActiveModal({ type: 'apply_snapshot', targetSnapshot: snapshot })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--nysc-green)] text-white text-xs font-extrabold hover:opacity-90 active:scale-95 transition-all shadow-sm"
                          >
                            <span>Apply to Live Board</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Collapsible Roster Preview */}
                    {isExpanded && (
                      <div className="border-t border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 space-y-4">
                        {(Object.values(snapshot.rosters) as RostersMap[keyof RostersMap][]).map((r) => (
                          <div key={r.id} className="space-y-1.5">
                            <h4 className="text-xs font-bold text-[var(--nysc-green)] flex items-center gap-2">
                              <span>{r.icon}</span> {r.title}
                            </h4>
                            <div className="overflow-x-auto rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-xs">
                              <table className="w-full text-left">
                                <thead className="bg-[var(--nysc-green)] text-white text-[10px] uppercase font-bold">
                                  <tr>
                                    <th className="p-2">Day</th>
                                    {r.columns.map((c) => (
                                      <th key={c.key} className="p-2">{c.label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.rows.map((row, idx) => (
                                    <tr key={idx} className="border-t border-[var(--card-border)]">
                                      <td className="p-2 font-extrabold text-[var(--nysc-green)]">{row.day}</td>
                                      {r.columns.map((c) => (
                                        <td key={c.key} className="p-2 font-medium">{row[c.key] || ''}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={activeModal?.type === 'rollback'}
        title="Revert Live Schedule?"
        message="Are you sure you want to revert the live schedule board to the state saved right before the last publication?"
        confirmText="Revert Schedule"
        onConfirm={handleRollback}
        onCancel={() => setActiveModal(null)}
      />

      <ConfirmModal
        isOpen={activeModal?.type === 'apply_snapshot'}
        title={`Apply ${activeModal?.targetSnapshot?.weekLabel}?`}
        message={`Are you sure you want to load the ${activeModal?.targetSnapshot?.weekLabel} canon schedule onto the live schedule board? Current live schedules will be replaced.`}
        confirmText="Apply to Live Board"
        onConfirm={() => activeModal?.targetSnapshot && handleApplySnapshot(activeModal.targetSnapshot)}
        onCancel={() => setActiveModal(null)}
      />
    </div>
  );
}
