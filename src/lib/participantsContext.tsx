'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_PARTICIPANT_NAMES } from '@/lib/constants';
import type { Participant, ParticipantsPayload } from '@/lib/types';
import { useAuth } from '@/lib/authContext';
import { getFallbackParticipantId } from '@/lib/participants';

interface ParticipantMutationResult {
  success: boolean;
  error?: string;
}

interface ParticipantsDataContextType {
  participants: Participant[];
  participantNames: string[];
}

interface ParticipantsManagementContextType {
  isLoading: boolean;
  isMutating: boolean;
  persistenceAvailable: boolean;
  error: string | null;
  refreshParticipants: () => Promise<void>;
  addParticipant: (name: string) => Promise<ParticipantMutationResult>;
  removeParticipant: (id: string) => Promise<ParticipantMutationResult>;
}

const FALLBACK_PARTICIPANTS: Participant[] = DEFAULT_PARTICIPANT_NAMES.map((name) => ({
  id: getFallbackParticipantId(name),
  name,
}));

const ParticipantsDataContext = createContext<ParticipantsDataContextType>({
  participants: FALLBACK_PARTICIPANTS,
  participantNames: [...DEFAULT_PARTICIPANT_NAMES],
});

const ParticipantsManagementContext = createContext<ParticipantsManagementContextType>({
  isLoading: true,
  isMutating: false,
  persistenceAvailable: false,
  error: null,
  refreshParticipants: async () => {},
  addParticipant: async () => ({ success: false }),
  removeParticipant: async () => ({ success: false }),
});

function sortParticipants(participants: Participant[]): Participant[] {
  return [...participants].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      const error = (body as Record<string, unknown>).error;
      if (typeof error === 'string') return error;
    }
  } catch {
    // Use the caller's safe fallback message.
  }
  return fallback;
}

export function ParticipantsProvider({ children }: { children: React.ReactNode }) {
  const { authRole, authPassword } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>(FALLBACK_PARTICIPANTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [persistenceAvailable, setPersistenceAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshParticipants = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/participants', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) {
        throw new Error(await readError(response, 'Unable to load house members.'));
      }

      const payload = await response.json() as ParticipantsPayload;
      setParticipants(sortParticipants(payload.participants));
      setPersistenceAvailable(payload.persistenceAvailable);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load house members.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshParticipants();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refreshParticipants]);

  const addParticipant = useCallback(async (name: string): Promise<ParticipantMutationResult> => {
    if (authRole !== 'master' || !authPassword) {
      return { success: false, error: 'Only the Master Admin can add house members.' };
    }

    setIsMutating(true);
    try {
      const response = await fetch('/api/participants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authPassword,
        },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const message = await readError(response, 'Unable to add the house member.');
        setError(message);
        return { success: false, error: message };
      }

      const body = await response.json() as { participant: Participant };
      setParticipants((current) => sortParticipants([...current, body.participant]));
      setError(null);
      return { success: true };
    } catch {
      const message = 'Unable to add the house member.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsMutating(false);
    }
  }, [authPassword, authRole]);

  const removeParticipant = useCallback(async (id: string): Promise<ParticipantMutationResult> => {
    if (authRole !== 'master' || !authPassword) {
      return { success: false, error: 'Only the Master Admin can remove house members.' };
    }

    setIsMutating(true);
    try {
      const response = await fetch(`/api/participants?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-auth-password': authPassword },
      });
      if (!response.ok) {
        const message = await readError(response, 'Unable to remove the house member.');
        setError(message);
        return { success: false, error: message };
      }

      setParticipants((current) => current.filter((participant) => participant.id !== id));
      setError(null);
      return { success: true };
    } catch {
      const message = 'Unable to remove the house member.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsMutating(false);
    }
  }, [authPassword, authRole]);

  const participantNames = useMemo(
    () => participants.map((participant) => participant.name),
    [participants],
  );
  const participantData = useMemo(
    () => ({ participants, participantNames }),
    [participantNames, participants],
  );
  const participantManagement = useMemo(
    () => ({
      isLoading,
      isMutating,
      persistenceAvailable,
      error,
      refreshParticipants,
      addParticipant,
      removeParticipant,
    }),
    [
      addParticipant,
      error,
      isLoading,
      isMutating,
      persistenceAvailable,
      refreshParticipants,
      removeParticipant,
    ],
  );

  return (
    <ParticipantsDataContext.Provider value={participantData}>
      <ParticipantsManagementContext.Provider value={participantManagement}>
        {children}
      </ParticipantsManagementContext.Provider>
    </ParticipantsDataContext.Provider>
  );
}

export function useParticipants() {
  return useContext(ParticipantsDataContext);
}

export function useParticipantManagement() {
  return useContext(ParticipantsManagementContext);
}
