'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Plus, Trash2, Users, X } from 'lucide-react';
import { useParticipantManagement, useParticipants } from '@/lib/participantsContext';
import { useToast } from '@/lib/toastContext';
import ConfirmModal from '@/components/ConfirmModal';
import type { Participant } from '@/lib/types';

export default function ParticipantManager() {
  const { participants } = useParticipants();
  const {
    isLoading,
    isMutating,
    persistenceAvailable,
    error,
    refreshParticipants,
    addParticipant,
    removeParticipant,
  } = useParticipantManagement();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<Participant | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isMutating) return;
      if (pendingRemoval) setPendingRemoval(null);
      else setIsOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isMutating, isOpen, pendingRemoval]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const result = await addParticipant(trimmedName);
    if (result.success) {
      setName('');
      showToast(`${trimmedName} added to the house members list.`, 'success');
      inputRef.current?.focus();
    } else {
      showToast(result.error || 'Unable to add the house member.', 'error');
    }
  };

  const handleConfirmedRemove = async () => {
    if (!pendingRemoval) return;
    const participant = pendingRemoval;
    setPendingRemoval(null);
    const result = await removeParticipant(participant.id);
    if (result.success) {
      showToast(`${participant.name} removed from future dropdown choices.`, 'success');
    } else {
      showToast(result.error || 'Unable to remove the house member.', 'error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          void refreshParticipants();
        }}
        className="p-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)] hover:bg-[var(--nysc-green)]/10 transition-colors"
        title="Manage house members"
        aria-label="Manage house members"
      >
        <Users className="w-4 h-4 text-[var(--nysc-green)]" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isMutating) setIsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="participant-manager-title"
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="participant-manager-title" className="text-lg font-black text-[var(--nysc-green)]">
                  House Members
                </h2>
                <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                  Add or remove the names shown in roster dropdowns.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isMutating}
                className="rounded-full p-1.5 text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text-primary)] disabled:opacity-40 dark:hover:bg-white/10"
                aria-label="Close member manager"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(!persistenceAvailable || error) && !isLoading && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                <p>
                  {error || 'Database persistence is not configured. Add and remove are disabled.'}
                </p>
                <button
                  type="button"
                  onClick={() => void refreshParticipants()}
                  className="shrink-0 rounded-lg border border-current px-2.5 py-1.5 text-[11px] font-extrabold hover:bg-amber-500/10 disabled:opacity-40"
                >
                  Retry
                </button>
              </div>
            )}

            <form onSubmit={handleAdd} className="mt-4 flex gap-2">
              <label htmlFor="new-participant-name" className="sr-only">New house member name</label>
              <input
                ref={inputRef}
                id="new-participant-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="Enter a member’s name"
                disabled={!persistenceAvailable || isMutating}
                className="min-w-0 flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--bg-page)] px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--nysc-green)] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!name.trim() || !persistenceAvailable || isMutating}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--nysc-green)] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between border-b border-[var(--card-border)] pb-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-[var(--text-muted)]">
                Current members
              </h3>
              <span className="rounded-full bg-[var(--nysc-green)]/10 px-2 py-0.5 text-[11px] font-black text-[var(--nysc-green)]">
                {participants.length}
              </span>
            </div>

            <div className="mt-2 min-h-0 max-h-72 flex-1 space-y-1 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-xs font-bold text-[var(--text-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading members…
                </div>
              ) : participants.length === 0 ? (
                <p className="py-10 text-center text-xs font-semibold text-[var(--text-muted)]">
                  No house members have been added yet.
                </p>
              ) : participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="min-w-0 truncate text-sm font-bold text-[var(--text-primary)]">
                    {participant.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingRemoval(participant)}
                    disabled={!persistenceAvailable || isMutating}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold text-red-600 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400"
                    aria-label={`Remove ${participant.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              ))}
            </div>

          </section>
        </div>,
        document.body,
      )}

      <ConfirmModal
        isOpen={pendingRemoval !== null}
        title={`Remove ${pendingRemoval?.name || 'house member'}?`}
        message="This removes the name from future roster dropdowns. Existing roster entries and archived weeks will remain unchanged."
        confirmText="Remove member"
        isDangerous
        onConfirm={() => void handleConfirmedRemove()}
        onCancel={() => setPendingRemoval(null)}
      />
    </>
  );
}
