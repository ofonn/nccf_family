'use client';

import React, { useState } from 'react';
import { Save, XCircle, RotateCcw, Download, Sparkles } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/lib/toastContext';

interface ControlDockProps {
  hasEditAccess: boolean;
  unsavedCount: number;
  onSave: () => Promise<void> | void;
  onCancel: () => void;
  onReset: () => Promise<void> | void;
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
  const { showToast } = useToast();
  
  const [activeModal, setActiveModal] = useState<'save' | 'cancel' | 'reset' | null>(null);

  const handleConfirmSave = async () => {
    setActiveModal(null);
    await onSave();
    showToast('Roster changes saved successfully to database!', 'success');
  };

  const handleConfirmCancel = () => {
    setActiveModal(null);
    onCancel();
    showToast('Unsaved edits discarded.', 'info');
  };

  const handleConfirmReset = async () => {
    setActiveModal(null);
    await onReset();
    showToast('Rosters reset to default schedules.', 'success');
  };

  const handleDownloadClick = () => {
    onDownload();
    showToast('Preparing official PNG poster download...', 'info');
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 transition-all duration-300">
        <div className="bg-[var(--card-bg)]/95 border border-[var(--card-border)] rounded-2xl p-2.5 sm:p-3 shadow-2xl backdrop-blur-xl flex items-center gap-2 sm:gap-3">
          
          {/* Edit Mode Badge */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--bg-page)] border border-[var(--card-border)]">
            <Sparkles className="w-4 h-4 text-[var(--nysc-gold)] animate-pulse shrink-0" />
            <div className="text-left hidden sm:block">
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

          {/* Admin Buttons */}
          {hasEditAccess && (
            <>
              {/* Save Button */}
              <button
                onClick={() => setActiveModal('save')}
                disabled={isSaving || unsavedCount === 0}
                className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-md transition-all ${
                  unsavedCount > 0
                    ? 'bg-[var(--nysc-green)] hover:opacity-90 active:scale-95'
                    : 'bg-gray-400 opacity-50 cursor-not-allowed'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>

              {/* Cancel Button */}
              {unsavedCount > 0 && (
                <button
                  onClick={() => setActiveModal('cancel')}
                  className="p-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-red-500 hover:bg-red-50 transition-colors"
                  title="Cancel Unsaved Edits"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}

              {/* Reset Button */}
              <button
                onClick={() => setActiveModal('reset')}
                className="p-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--nysc-gold)] hover:bg-[var(--nysc-gold-light)] transition-colors"
                title="Reset Roster Defaults"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Export PNG Button */}
          <button
            onClick={handleDownloadClick}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-[var(--sky-blue)] text-white text-xs font-extrabold shadow-md hover:opacity-90 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PNG</span>
          </button>
        </div>
      </div>

      {/* Confirmation Warnings */}
      <ConfirmModal
        isOpen={activeModal === 'save'}
        title="Save Changes?"
        message={`Are you sure you want to commit ${unsavedCount} edit(s) to the live database? This will update schedules for everyone.`}
        confirmText="Save to Database"
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
        message="WARNING: This will erase all custom roster edits and restore default schedules for Prayer, Service, Cleaning, and Cooking!"
        confirmText="Reset to Defaults"
        isDangerous={true}
        onConfirm={handleConfirmReset}
        onCancel={() => setActiveModal(null)}
      />
    </>
  );
}
