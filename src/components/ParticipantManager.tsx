'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Plus, Trash2, Users, X } from 'lucide-react';
import { useParticipants } from '@/lib/participantsContext';
import { useToast } from '@/lib/toastContext';

export default function ParticipantManager() {
  const {
    participants,
    isLoading,
    isMutating,
    persistenceAvailable,
    error,
    addParticipant,
    removeParticipant,
  } = useParticipants();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isMutating) setIsOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isMutating, isOpen]);

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

  const handleRemove = async (id: string, participantName: string) => {
    const result = await removeParticipant(id);
    if (result.success) {
      showToast(`${participantName} removed from future dropdown choices.`, 'success');
    } else {
      showToast(result.error || 'Unable to remove the house member.', 'error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
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

            {!persistenceAvailable && !isLoading && (
              <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                Database connection is unavailable. Add and remove are disabled.
              </p>
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
                    onClick={() => void handleRemove(participant.id, participant.name)}
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

            {error && persistenceAvailable && (
              <p className="mt-3 text-xs font-bold text-red-500">{error}</p>
            )}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
