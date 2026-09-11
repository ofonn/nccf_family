'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  // Portal to <body> so the dialog always paints above other modals.
  // Rendered inline it would be trapped inside an ancestor stacking
  // context (e.g. the sticky navbar) and appear blurred underneath the
  // modal that opened it.
  return createPortal(
    <div
      data-testid="confirm-overlay"
      className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDangerous ? 'bg-red-500/20 text-red-500' : 'bg-[var(--nysc-gold-light)] text-[var(--nysc-gold)]'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[var(--text-primary)]">
              {title}
            </h3>
            <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">
              Please confirm your action
            </p>
          </div>
        </div>

        <p className="text-xs text-[var(--text-primary)] font-semibold leading-relaxed">
          {message}
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-[var(--card-border)] bg-[var(--bg-page)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2 text-xs font-extrabold rounded-xl text-white shadow-md hover:opacity-90 ${
              isDangerous ? 'bg-red-600' : 'bg-[var(--nysc-green)]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
