'use client';

import React from 'react';
import { Roster, RostersMap } from '@/lib/types';
import { exportRosterPNG, exportAllRostersPNG } from '@/components/PosterExporter';
import { useToast } from '@/lib/toastContext';
import { Download, X, Layers } from 'lucide-react';

interface RosterSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  rosters: RostersMap;
  isDark: boolean;
}

export default function RosterSelectModal({
  isOpen,
  onClose,
  rosters,
  isDark,
}: RosterSelectModalProps) {
  const { showToast } = useToast();

  if (!isOpen) return null;

  const rosterList: { id: keyof RostersMap; roster: Roster }[] = [
    { id: 'prayer_roster', roster: rosters.prayer_roster },
    { id: 'glorious_service', roster: rosters.glorious_service },
    { id: 'cleaning_roster', roster: rosters.cleaning_roster },
    { id: 'cooking_roster', roster: rosters.cooking_roster },
  ];

  const handleSelectRoster = (roster: Roster) => {
    onClose();
    showToast(`Preparing ${roster.title} PNG poster...`, 'info');
    exportRosterPNG(roster, isDark);
  };

  const handleSelectAll = () => {
    onClose();
    showToast('Preparing Master All-Rosters PNG poster...', 'info');
    exportAllRostersPNG(rosters, isDark);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 shadow-2xl z-10 transition-all space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--sky-blue)]/15 text-[var(--sky-blue)]">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[var(--nysc-green)] tracking-tight">
                Export PNG Poster
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-semibold">
                Select which roster schedule to download
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Roster Options List */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {rosterList.map(({ id, roster }) => (
            <button
              key={id}
              onClick={() => handleSelectRoster(roster)}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 hover:bg-[var(--nysc-green)]/10 hover:border-[var(--nysc-green)]/40 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{roster.icon}</span>
                <div>
                  <h4 className="text-xs font-bold text-[var(--foreground)] group-hover:text-[var(--nysc-green)] transition-colors">
                    {roster.title}
                  </h4>
                  <p className="text-[10px] text-[var(--text-muted)] font-medium">
                    {roster.rows.length} schedule entries
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--nysc-green)] transition-colors" />
            </button>
          ))}

          {/* Master Export All Option */}
          <button
            onClick={handleSelectAll}
            className="w-full flex items-center justify-between p-3.5 rounded-xl border border-[var(--nysc-green)]/30 bg-[var(--nysc-green)]/10 hover:bg-[var(--nysc-green)]/20 hover:border-[var(--nysc-green)] transition-all text-left group mt-3"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--nysc-green)] text-white">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-[var(--nysc-green)]">
                  All Schedules (Master Image)
                </h4>
                <p className="text-[10px] text-[var(--text-muted)] font-medium">
                  Export complete weekly master schedule
                </p>
              </div>
            </div>
            <Download className="w-4 h-4 text-[var(--nysc-green)]" />
          </button>
        </div>
      </div>
    </div>
  );
}
