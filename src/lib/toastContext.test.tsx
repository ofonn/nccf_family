import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from './toastContext';

afterEach(cleanup);

function ToastTrigger() {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast('Member added.', 'success')}>
      Notify
    </button>
  );
}

describe('ToastProvider', () => {
  it('renders notifications above modal backdrops', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    const message = screen.getByText('Member added.');
    const toastRegion = message.closest('.fixed');

    expect(toastRegion?.className).toContain('z-[30000]');
    expect(toastRegion?.className).toContain('top-4');
  });
});
