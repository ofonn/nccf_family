'use client';

import React from 'react';
import { ClashWarning } from '@/lib/types';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ClashCheckerAlertProps {
  clashes: ClashWarning[];
}

export default function ClashCheckerAlert({ clashes }: ClashCheckerAlertProps) {
  if (clashes.length === 0) {
    return (
      <div className="w-full bg-[var(--table-stripe)] border border-[var(--nysc-green)]/30 rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-[var(--nysc-green)] shrink-0" />
        <div>
          <h4 className="text-xs font-extrabold text-[var(--nysc-green)] uppercase tracking-wider">
            No Schedule Conflicts
          </h4>
          <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">
            All duty assignments across the 4 rosters are clear and clash-free.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-red-500/10 border border-red-500/40 rounded-2xl p-4 shadow-md space-y-3">
      <div className="flex items-center gap-2 text-red-500">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <h4 className="text-sm font-extrabold tracking-tight">
          ⚠️ {clashes.length} Double-Scheduling Conflict{clashes.length > 1 ? 's' : ''} Detected
        </h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {clashes.map((clash, index) => (
          <div
            key={index}
            className="bg-[var(--card-bg)] border border-red-500/30 rounded-xl p-3 text-xs space-y-1 shadow-sm"
          >
            <div className="flex items-center justify-between font-extrabold text-red-500">
              <span>{clash.person}</span>
              <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-500">
                {clash.day}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Assigned to overlapping duties:
            </p>
            <ul className="list-disc list-inside font-semibold text-[var(--text-primary)] space-y-0.5 pl-1">
              <li>{clash.activityA.rosterTitle} ({clash.activityA.timeStr || 'All Day'})</li>
              <li>{clash.activityB.rosterTitle} ({clash.activityB.timeStr || 'All Day'})</li>
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
