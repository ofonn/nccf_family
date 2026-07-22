'use client';

import React, { useState } from 'react';
import { Save, XCircle, RotateCcw, Download, Sparkles } from 'lucide-react';

interface ControlDockProps {
  hasEditAccess: boolean;
  unsavedCount: number;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
  onDownload: () => void;
  isSaving: boolean;
}

export default function ControlDock({
  hasEditAccess,
  unsavedCount,
  onSave,
  onCancel,
  onReset,
  onDownload,
  isSaving,
}: ControlDockProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 transition-all duration-300">
      <div className="bg-[var(--card-bg)]/95 border border-[var(--card-border)] rounded-2xl p-3 shadow-2xl backdrop-blur-xl flex items-center gap-3">
        
        {/* Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-page)] border border-[var(--card-border)]">
          <Sparkles className="w-4 h-4 text-[var(--nysc-gold)] animate-pulse" />
          <div className="text-left">
            <p className="text-[11px] font-extrabold text-[var(--nysc-green)] leading-none">
              {hasEditAccess ? 'Admin Edit Mode' : 'View Mode'}
            </p>
            {unsavedCount > 0 && (
              <span className="text-[10px] font-extrabold text-[var(--nysc-gold)]">
                {unsavedCount} unsaved edit{unsavedCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Save Button (when editing unlocked) */}
        {hasEditAccess && (
          <>
            <button
              onClick={onSave}
              disabled={isSaving || unsavedCount === 0}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-md transition-all ${
                unsavedCount > 0
                  ? 'bg-[var(--nysc-green)] hover:opacity-90 active:scale-95'
                  : 'bg-gray-400 opacity-50 cursor-not-allowed'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>

            {unsavedCount > 0 && (
              <button
                onClick={onCancel}
                className="p-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-red-500 hover:bg-red-50 transition-colors"
                title="Cancel Edits"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onReset}
              className="p-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--nysc-gold)] hover:bg-[var(--nysc-gold-light)] transition-colors"
              title="Reset Roster Defaults"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Download Poster Button */}
        <button
          onClick={onDownload}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--sky-blue)] text-white text-xs font-extrabold shadow-md hover:opacity-90 active:scale-95 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export PNG</span>
        </button>
      </div>
    </div>
  );
}
