import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShareResultActions } from './ShareResultActions';

const originalClipboard = navigator.clipboard;
const originalShare = navigator.share;

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  });
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: originalShare,
  });
});

describe('ShareResultActions', () => {
  it('communicates copy success through an accessible status', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<ShareResultActions sharePath="/build/v1.test" />);

    await user.click(screen.getByRole('button', { name: 'Copy result link' }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/build/v1.test`);
    expect(screen.getByRole('status')).toHaveTextContent(/link copied/i);
  });

  it('communicates copy failure and exposes native share when supported', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share,
    });

    render(<ShareResultActions sharePath="/build/v1.test" />);

    expect(screen.getByRole('button', { name: 'Share result' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy result link' }));
    expect(screen.getByRole('status')).toHaveTextContent(/sharing failed/i);

    await user.click(screen.getByRole('button', { name: 'Share result' }));
    expect(share).toHaveBeenCalledWith({
      title: 'BuildChamp result',
      text: 'Look at this BuildChamp composite champion.',
      url: `${window.location.origin}/build/v1.test`,
    });
    expect(screen.getByRole('status')).toHaveTextContent(/share sheet opened/i);
  });
});
