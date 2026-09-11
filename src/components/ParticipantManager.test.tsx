import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ParticipantManager from './ParticipantManager';

const mocks = vi.hoisted(() => ({
  addParticipant: vi.fn(),
  removeParticipant: vi.fn(),
  refreshParticipants: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@/lib/participantsContext', () => ({
  useParticipants: () => ({
    participants: [{ id: 'ada-id', name: 'Ada' }],
  }),
  useParticipantManagement: () => ({
    isLoading: false,
    isMutating: false,
    persistenceAvailable: true,
    error: null,
    refreshParticipants: mocks.refreshParticipants,
    addParticipant: mocks.addParticipant,
    removeParticipant: mocks.removeParticipant,
  }),
}));

vi.mock('@/lib/toastContext', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ParticipantManager', () => {
  it('requires confirmation before removing a member and reports success', async () => {
    mocks.removeParticipant.mockResolvedValue({ success: true });
    render(<ParticipantManager />);

    fireEvent.click(screen.getByRole('button', { name: 'Manage house members' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ada' }));

    expect(screen.getByText('Remove Ada?')).toBeTruthy();
    expect(screen.getByText(/Existing roster entries and archived weeks will remain unchanged/)).toBeTruthy();
    expect(mocks.removeParticipant).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove member' }));

    await waitFor(() => expect(mocks.removeParticipant).toHaveBeenCalledWith('ada-id'));
    expect(mocks.showToast).toHaveBeenCalledWith(
      'Ada removed from future dropdown choices.',
      'success',
    );
  });

  it('reports a successful addition while keeping the manager open', async () => {
    mocks.addParticipant.mockResolvedValue({ success: true });
    render(<ParticipantManager />);

    fireEvent.click(screen.getByRole('button', { name: 'Manage house members' }));
    fireEvent.change(screen.getByPlaceholderText('Enter a member’s name'), {
      target: { value: 'Bola' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(mocks.addParticipant).toHaveBeenCalledWith('Bola'));
    expect(mocks.showToast).toHaveBeenCalledWith(
      'Bola added to the house members list.',
      'success',
    );
    expect(screen.getByRole('dialog', { name: 'House Members' })).toBeTruthy();
  });

  it('portals the remove confirmation above ancestor stacking contexts', async () => {
    mocks.removeParticipant.mockResolvedValue({ success: true });
    // Simulate the sticky navbar: a positioned ancestor with its own
    // z-index traps non-portalled overlays underneath body-level modals.
    render(
      <div style={{ position: 'sticky', zIndex: 40 }}>
        <ParticipantManager />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Manage house members' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ada' }));

    const overlay = await screen.findByTestId('confirm-overlay');
    expect(overlay.parentElement).toBe(document.body);
    expect(screen.getByText('Remove Ada?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove member' }));
    await waitFor(() => expect(mocks.removeParticipant).toHaveBeenCalledWith('ada-id'));
  });
});
