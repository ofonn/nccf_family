import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RosterGeneratorModal, { type RosterGeneratorPreview } from './RosterGeneratorModal';
import { DEFAULT_ROSTERS } from '@/lib/constants';
import type { Participant } from '@/lib/types';

afterEach(cleanup);

const participants: Participant[] = [
  { id: 'a', name: 'Ada' },
  { id: 'b', name: 'Bola' },
  { id: 'c', name: 'Chidi' },
  { id: 'd', name: 'Dara' },
];

const preview: RosterGeneratorPreview = {
  mode: 'weighted',
  rosters: DEFAULT_ROSTERS,
  allocation: {
    availableMembers: participants.map((participant) => participant.id),
    generatedAt: '2026-08-16T00:00:00.000Z',
    mode: 'weighted',
  },
  memberSummaries: participants.map((participant) => ({
    memberId: participant.id,
    name: participant.name,
    weeklyPoints: 3,
    targetPoints: 3,
    deviation: 0,
    assignmentCount: 2,
    cookingTurns: 1,
    cleaningTurns: 0,
  })),
  fairnessIndex: 1,
  loadRange: 0,
  warnings: [],
};

describe('RosterGeneratorModal', () => {
  it('submits only the selected available members and applies a generated draft', async () => {
    const onGenerate = vi.fn((input: {
      availableMembers: Participant[];
      weekStart: string;
      seed: string;
      mode: 'weighted' | 'appearances';
    }) => {
      void input;
      return preview;
    });
    const onApply = vi.fn();

    render(
      <RosterGeneratorModal
        isOpen
        participants={participants}
        onClose={vi.fn()}
        onGenerate={onGenerate}
        onApply={onApply}
      />,
    );

    await screen.findByText('4 of 4 selected');
    fireEvent.click(screen.getByRole('button', { name: 'Bola' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await screen.findByText('Fairness preview');
    expect(onGenerate).toHaveBeenCalledOnce();
    const generationInput = onGenerate.mock.calls[0]?.[0];
    expect(generationInput).toBeDefined();
    if (!generationInput) throw new Error('Expected a generator call.');
    expect(generationInput.availableMembers.map((member) => member.name)).toEqual(['Ada', 'Chidi', 'Dara']);
    expect(generationInput.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(generationInput.seed.length).toBeGreaterThan(0);
    expect(generationInput.mode).toBe('weighted');

    fireEvent.click(screen.getByRole('button', { name: 'Apply Draft' }));
    expect(onApply).toHaveBeenCalledWith(preview, generationInput.weekStart);
  });

  it('requires three members because paired cooks cannot cover another same-day duty', async () => {
    render(
      <RosterGeneratorModal
        isOpen
        participants={participants}
        onClose={vi.fn()}
        onGenerate={vi.fn(() => preview)}
        onApply={vi.fn()}
      />,
    );

    await screen.findByText('4 of 4 selected');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ada' }));
    expect((screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Bola' }));
    expect((screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Chidi' }));
    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('offers an equal-appearances mode as a separate generation method', async () => {
    const appearancePreview: RosterGeneratorPreview = {
      ...preview,
      mode: 'appearances',
      allocation: { ...preview.allocation, mode: 'appearances' },
      memberSummaries: preview.memberSummaries.map((summary) => ({
        ...summary,
        weeklyPoints: summary.assignmentCount,
      })),
      loadRange: 1,
    };
    const onGenerate = vi.fn(() => appearancePreview);

    render(
      <RosterGeneratorModal
        isOpen
        participants={participants}
        onClose={vi.fn()}
        onGenerate={onGenerate}
        onApply={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Equal appearances/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await screen.findByText(/appearance spread 1/);
    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({ mode: 'appearances' }));
    expect(screen.getAllByText(/appearances$/i).length).toBeGreaterThan(0);
  });
});
