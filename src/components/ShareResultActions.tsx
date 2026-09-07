import { useState } from 'react';

import { useSound } from '../lib/sound';

type ShareResultActionsProps = {
  readonly sharePath: string;
};

type ShareStatus = 'idle' | 'copied' | 'shared' | 'cancelled' | 'failed';

const SHARE_STATUS_COPY: Readonly<Record<Exclude<ShareStatus, 'idle'>, string>> = {
  copied: 'Link copied. Share it with anyone who wants to judge the build.',
  shared: 'Share sheet opened.',
  cancelled: 'Share cancelled. The result link is still ready to copy.',
  failed: 'Sharing failed. Copy the link or use the address bar instead.',
};

export function ShareResultActions({ sharePath }: ShareResultActionsProps) {
  const sound = useSound();
  const [status, setStatus] = useState<ShareStatus>('idle');
  const canUseNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  function shareUrl(): string {
    if (typeof window === 'undefined') {
      return sharePath;
    }

    return new URL(sharePath, window.location.href).toString();
  }

  async function handleCopy() {
    sound.unlock();

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }

      await navigator.clipboard.writeText(shareUrl());
      sound.play('share');
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  async function handleNativeShare() {
    sound.unlock();

    try {
      await navigator.share({
        title: 'BuildChamp result',
        text: 'Look at this BuildChamp composite champion.',
        url: shareUrl(),
      });
      sound.play('share');
      setStatus('shared');
    } catch (error) {
      setStatus(
        error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed',
      );
    }
  }

  return (
    <div className="share-actions">
      <div className="share-actions__buttons">
        <button className="button button--secondary" onClick={handleCopy} type="button">
          Copy result link
        </button>
        {canUseNativeShare && (
          <button className="button button--secondary" onClick={handleNativeShare} type="button">
            Share result
          </button>
        )}
      </div>
      {status !== 'idle' && (
        <p aria-live="polite" className="share-actions__status" role="status">
          {SHARE_STATUS_COPY[status]}
        </p>
      )}
    </div>
  );
}
