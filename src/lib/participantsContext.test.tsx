import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ParticipantsProvider,
  useParticipantManagement,
  useParticipants,
} from './participantsContext';

vi.mock('@/lib/authContext', () => ({
  useAuth: () => ({
    authRole: 'master',
    authPassword: 'test-password',
  }),
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ParticipantsProvider render isolation', () => {
  it('does not rerender data consumers for an isMutating-only transition', async () => {
    const pendingDelete = deferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') return pendingDelete.promise;
      return Promise.resolve(jsonResponse({
        participants: [
          { id: 'ada', name: 'Ada' },
          { id: 'bola', name: 'Bola' },
        ],
        persistenceAvailable: true,
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    let dataRenderCount = 0;
    let managementRenderCount = 0;

    function DataConsumer() {
      dataRenderCount += 1;
      const { participants } = useParticipants();
      return <output data-testid="participant-data">{participants.map(({ name }) => name).join(',')}</output>;
    }

    function ManagementConsumer() {
      managementRenderCount += 1;
      const { isLoading, isMutating, removeParticipant } = useParticipantManagement();
      return (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => void removeParticipant('ada')}
        >
          {isMutating ? 'Removing' : 'Remove Ada'}
        </button>
      );
    }

    render(
      <ParticipantsProvider>
        <DataConsumer />
        <ManagementConsumer />
      </ParticipantsProvider>,
    );

    await screen.findByText('Ada,Bola');
    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Remove Ada' }) as HTMLButtonElement).disabled)
        .toBe(false);
    });
    const dataRendersBeforeMutation = dataRenderCount;
    const managementRendersBeforeMutation = managementRenderCount;

    fireEvent.click(screen.getByRole('button', { name: 'Remove Ada' }));
    await screen.findByRole('button', { name: 'Removing' });

    expect(managementRenderCount).toBeGreaterThan(managementRendersBeforeMutation);
    expect(dataRenderCount).toBe(dataRendersBeforeMutation);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/participants?id=ada',
      expect.objectContaining({ method: 'DELETE' }),
    );

    await act(async () => {
      pendingDelete.resolve(jsonResponse({ success: true }));
      await pendingDelete.promise;
    });

    await screen.findByText('Bola');
    expect(dataRenderCount).toBe(dataRendersBeforeMutation + 1);
  });
});
