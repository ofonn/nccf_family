'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import RosterCard from '@/components/RosterCard';
import ClashCheckerAlert from '@/components/ClashCheckerAlert';
import ControlDock from '@/components/ControlDock';
import RosterSelectModal from '@/components/RosterSelectModal';
import RosterGeneratorModal, { type RosterGeneratorPreview } from '@/components/RosterGeneratorModal';
import { exportAllRostersPNG } from '@/components/PosterExporter';
import { RostersMap } from '@/lib/types';
import { performClashCheck } from '@/lib/clashChecker';
import { generateFairRoster } from '@/lib/fairRoster';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/themeContext';
import { useRosters } from '@/lib/rostersContext';
import { useParticipants } from '@/lib/participantsContext';
import { useToast } from '@/lib/toastContext';
import { Loader2, Scale, Shuffle } from 'lucide-react';

export default function HomePage() {
  const { authRole } = useAuth();
  const { isDark } = useTheme();
  const { participants } = useParticipants();
  const { showToast } = useToast();
  const {
    rosters,
    savedRosters,
    isLoading,
    handleCellChange,
    applyGeneratedDraft,
    getPriorBalancesForWeek,
  } = useRosters();
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  const clashes = performClashCheck(rosters);

  const rosterEntries: { key: keyof RostersMap; editCheck: boolean }[] = [
    { key: 'prayer_roster', editCheck: authRole === 'master' || authRole === 'prayer_coordinator' },
    { key: 'glorious_service', editCheck: authRole === 'master' || authRole === 'prayer_coordinator' },
    { key: 'cleaning_roster', editCheck: authRole === 'master' },
    { key: 'cooking_roster', editCheck: authRole === 'master' || authRole === 'prayer_coordinator' },
  ];

  return (
    <div className="min-h-screen flex flex-col pb-28">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-3.5 py-5 space-y-5">
        {/* Banner Section */}
        <div className="text-center space-y-1.5 py-2 sm:py-3">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[var(--nysc-green)] tracking-tight leading-tight">
            NCCF Family House Schedules
          </h2>
          <p className="text-[11px] sm:text-xs text-[var(--text-muted)] max-w-md mx-auto font-semibold">
            Tap any cell to select options or double-tap to type custom entries.
          </p>
        </div>

        {authRole === 'master' && !isLoading && (
          <section className="flex flex-col gap-3 rounded-2xl border border-[var(--nysc-green)]/25 bg-[var(--nysc-green)]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-[var(--nysc-green)]/10 p-2 text-[var(--nysc-green)]">
                <Scale className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-black text-[var(--text-primary)]">Fair weekly work sharing</h3>
                <p className="mt-0.5 max-w-lg text-[11px] font-semibold text-[var(--text-muted)]">
                  Choose who is available, balance by effort or equal appearances, then review before publishing.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsGeneratorOpen(true)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--nysc-green)] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:opacity-90"
            >
              <Shuffle className="h-4 w-4" /> Share Work Fairly
            </button>
          </section>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--nysc-green)]">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
              Loading Roster Board...
            </p>
          </div>
        ) : (
          <>
            {/* Live Clash Warnings - Visible Only to Admins */}
            {authRole !== 'none' && <ClashCheckerAlert clashes={clashes} />}

            {/* Modular Table Cards */}
            <div className="space-y-5">
              {rosterEntries.map(({ key, editCheck }) => (
                <RosterCard
                  key={key}
                  roster={rosters[key]}
                  hasEditAccess={editCheck}
                  onCellChange={handleCellChange}
                  savedRows={savedRosters[key].rows}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <ControlDock
        hasEditAccess={authRole !== 'none'}
        onDownload={() => setIsSelectModalOpen(true)}
        onDownloadAll={() => exportAllRostersPNG(rosters, isDark)}
      />

      <RosterSelectModal
        isOpen={isSelectModalOpen}
        onClose={() => setIsSelectModalOpen(false)}
        rosters={rosters}
        isDark={isDark}
      />

      {isGeneratorOpen && (
        <RosterGeneratorModal
          isOpen
          participants={participants}
          onClose={() => setIsGeneratorOpen(false)}
          onGenerate={async ({ availableMembers, weekStart, seed, mode }): Promise<RosterGeneratorPreview> => {
            // Yield once so the modal can paint its balancing state before the
            // deterministic local search runs on the browser's main thread.
            await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
            const result = generateFairRoster({
              rosters,
              members: availableMembers,
              weekStart,
              mode,
              priorBalances: getPriorBalancesForWeek(weekStart, mode),
              seed,
              generatedAt: new Date().toISOString(),
            });
            return {
              mode,
              rosters: result.rosters,
              allocation: result.metadata,
              memberSummaries: result.memberSummaries,
              fairnessIndex: result.fairness.jainIndex,
              loadRange: result.fairness.loadRange,
              warnings: result.warnings,
            };
          }}
          onApply={(preview, weekStart) => {
            const availableMembers = participants.filter((participant) => (
              Array.isArray(preview.allocation.availableMemberIds)
              && preview.allocation.availableMemberIds.includes(participant.id)
            ));
            applyGeneratedDraft(
              preview.rosters,
              preview.allocation,
              weekStart,
              availableMembers,
            );
            setIsGeneratorOpen(false);
            showToast('Fair roster applied as a draft. Review it, then press Save to publish.', 'info');
          }}
        />
      )}
    </div>
  );
}
