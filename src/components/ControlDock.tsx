'use client';

import React, { useState } from 'react';
import { Save, XCircle, RotateCcw, Download, Sparkles } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/lib/toastContext';
import { useRosters } from '@/lib/rostersContext';

interface ControlDockProps {
  hasEditAccess: boolean;
  onDownload: () => void;
  onDownloadAll?: () => void;
}

export default function ControlDock({
  hasEditAccess,
  onDownload,
  onDownloadAll,
}: ControlDockProps) {
  const { showToast } = useToast();
  const { unsavedCount, saveChanges, cancelEdits, resetDefaults, isSaving } = useRosters();
  
  const [activeModal, setActiveModal] = useState<'save' | 'cancel' | 'reset' | null>(null);

  const handleConfirmSave = async () => {
    setActiveModal(null);
    const success = await saveChanges();
    if (success) {
      showToast('Roster changes published successfully!', 'success');
    } else {
      showToast('Failed to save changes.', 'error');
    }
  };

  const handleConfirmCancel = () => {
    setActiveModal(null);
    cancelEdits();
    showToast('Unsaved changes discarded.', 'info');
  };

  const handleConfirmReset = async () => {
    setActiveModal(null);
    const success = await resetDefaults();
    if (success) {
      showToast('Rosters reset to default schedules.', 'success');
    } else {
      showToast('Only Master Admin can reset.', 'error');
    }
  };

  const handleDownloadClick = () => {
    onDownload();
    showToast('Preparing PNG poster download...', 'info');
  };

  const handleDownloadAllClick = () => {
    if (onDownloadAll) {
      onDownloadAll();
      showToast('Preparing master all-rosters PNG download...', 'info');
    }
  };

  return (
    <>
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 transition-all duration-300">
        <div className="flex items-center gap-2.5 rounded-full bg-white/90 dark:bg-[#1C2541]/90 backdrop-blur-xl px-4 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.2)] border border-black/10 dark:border-white/10 text-xs font-bold shrink-0">
          
          {/* Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-page)] border border-[var(--card-border)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--nysc-gold)] animate-pulse shrink-0" />
            <span className="text-[11px] font-extrabold text-[var(--nysc-green)]">
              {hasEditAccess ? (unsavedCount > 0 ? `${unsavedCount} Unsaved` : 'Edit Mode') : 'View Mode'}
            </span>
          </div>

          {/* Admin Edit Controls (Only Visible when hasEditAccess is true!) */}
          {hasEditAccess && (
            <div className="flex items-center gap-1.5 border-l border-black/10 dark:border-white/10 pl-2">
              {/* Save Button */}
              <button
                onClick={() => setActiveModal('save')}
                disabled={isSaving || unsavedCount === 0}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold text-white shadow-sm transition-all ${
                  unsavedCount > 0
                    ? 'bg-[var(--nysc-green)] hover:opacity-90 active:scale-95'
                    : 'bg-gray-400 opacity-40 cursor-not-allowed'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Publishing...' : 'Save'}</span>
              </button>

              {/* Cancel Button */}
              {unsavedCount > 0 && (
                <button
                  onClick={() => setActiveModal('cancel')}
                  className="p-1.5 rounded-full border border-black/10 dark:border-white/10 bg-[var(--card-bg)] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title="Discard Unsaved Changes"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}

              {/* Reset Button */}
              <button
                onClick={() => setActiveModal('reset')}
                className="p-1.5 rounded-full border border-black/10 dark:border-white/10 bg-[var(--card-bg)] text-[var(--nysc-gold)] hover:bg-[var(--nysc-gold-light)] transition-colors"
                title="Reset Roster Defaults"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Export PNG Buttons */}
          <div className="flex items-center gap-1.5 border-l border-black/10 dark:border-white/10 pl-2">
            <button
              onClick={handleDownloadClick}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--sky-blue)] text-white text-[11px] font-extrabold shadow-sm hover:opacity-90 active:scale-95 transition-all"
              title="Export Current Roster PNG"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PNG</span>
            </button>

            {onDownloadAll && (
              <button
                onClick={handleDownloadAllClick}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--nysc-green)] text-white text-[11px] font-extrabold shadow-sm hover:opacity-90 active:scale-95 transition-all"
                title="Export All Schedules into One Master PNG"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export All</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Non-Technical Friendly Confirmation Modals */}
      <ConfirmModal
        isOpen={activeModal === 'save'}
        title="Publish Roster Changes?"
        message={`Are you sure you want to save ${unsavedCount} roster change(s)? This will update the official schedule for all fellowship members.`}
        confirmText="Publish Changes"
        onConfirm={handleConfirmSave}
        onCancel={() => setActiveModal(null)}
      />

      <ConfirmModal
        isOpen={activeModal === 'cancel'}
        title="Discard Unsaved Edits?"
        message="Are you sure you want to discard all unsaved edits made during this session?"
        confirmText="Discard Edits"
        isDangerous={true}
        onConfirm={handleConfirmCancel}
        onCancel={() => setActiveModal(null)}
      />

      <ConfirmModal
        isOpen={activeModal === 'reset'}
        title="Reset All Schedules?"
        message="WARNING: This will erase all custom edits and restore default schedules for Prayer, Service, Cleaning, and Cooking!"
        confirmText="Reset to Defaults"
        isDangerous={true}
        onConfirm={handleConfirmReset}
        onCancel={() => setActiveModal(null)}
      />
    </>
  );
}
