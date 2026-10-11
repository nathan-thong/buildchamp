import { useEffect, useRef, useState, type ReactNode } from 'react';

import type { AppRoute } from '../lib/routes';
import { readPreferences, writePreferences } from '../lib/preferences';
import { createSoundController, SoundContext, type SoundController } from '../lib/sound';
import { AppLink } from './AppLink';
import { BrandMark } from './BrandMark';
import { MuteControl } from './MuteControl';
import { SiteFooter } from './SiteFooter';
import { useOptionalLobbySession } from '../lib/lobby-session-context';

type AppShellProps = {
  readonly children: ReactNode;
  readonly currentRoute: AppRoute['kind'];
  readonly displayMode?: boolean;
  readonly storage?: Storage;
};

function navClass(isCurrent: boolean): string {
  return `site-nav__link ${isCurrent ? 'site-nav__link--current' : ''}`.trim();
}

export function AppShell({ children, currentRoute, displayMode = false, storage }: AppShellProps) {
  const [muted, setMuted] = useState(() => readPreferences(storage).muted);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const lobby = useOptionalLobbySession();
  const soundControllerRef = useRef<SoundController | null>(null);

  if (!soundControllerRef.current) {
    soundControllerRef.current = createSoundController({ muted });
  }

  const soundController = soundControllerRef.current;
  const isRoomRoute = currentRoute === 'room';

  async function leaveCurrentRoom() {
    if (!lobby) return;
    setLeaveError(null);
    try {
      await lobby.leaveActiveSession();
    } catch (error) {
      setLeaveError(error instanceof Error ? error.message : 'The room could not be left.');
    }
  }

  useEffect(() => {
    writePreferences({ version: 1, muted }, storage);
    soundController.setMuted(muted);
  }, [muted, soundController, storage]);

  return (
    <SoundContext.Provider value={soundController}>
      <div
        className="app-shell"
        onKeyDownCapture={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            soundController.unlock();
          }
        }}
        onPointerDownCapture={() => soundController.unlock()}
      >
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>

        <header className="site-header">
          <div className="site-header__inner">
            <AppLink aria-label="BuildChamp home" className="brand-link" href="/">
              <BrandMark className="brand-link__mark" />
              <span className="brand-link__words">
                <span className="brand-link__name">BuildChamp</span>
              </span>
            </AppLink>

            {!displayMode && (
              <nav aria-label="Primary navigation" className="site-nav">
                <AppLink
                  className={navClass(currentRoute === 'home')}
                  href="/"
                  aria-current={currentRoute === 'home' ? 'page' : undefined}
                >
                  <span>Home</span>
                </AppLink>
                <AppLink
                  className={navClass(currentRoute === 'solo')}
                  href="/solo"
                  aria-current={currentRoute === 'solo' ? 'page' : undefined}
                >
                  <span>Solo draft</span>
                </AppLink>
                <AppLink
                  className={navClass(currentRoute === 'lobby' || currentRoute === 'room')}
                  href="/lobby"
                  aria-current={
                    currentRoute === 'lobby' || currentRoute === 'room' ? 'page' : undefined
                  }
                >
                  <span>Rooms</span>
                </AppLink>
              </nav>
            )}

            <MuteControl muted={muted} onToggle={() => setMuted((current) => !current)} />
          </div>
        </header>

        {!displayMode && lobby?.session && (
          <aside aria-label="Active room" className="active-room-banner">
            <div className="active-room-banner__copy">
              <strong>Room {lobby.session.roomCode}</strong>
              <span>
                {lobby.status === 'connected'
                  ? 'Connected in this browser'
                  : lobby.status === 'blocked'
                    ? 'This tab no longer controls the room'
                    : 'Reconnecting to your room'}
              </span>
            </div>
            {!isRoomRoute && (
              <div className="active-room-banner__actions">
                <AppLink
                  className="button button--secondary button--small"
                  href={`/room/${lobby.session.roomCode}`}
                >
                  Return to room
                </AppLink>
                <button
                  className="text-action"
                  onClick={() => void leaveCurrentRoom()}
                  type="button"
                >
                  Leave room
                </button>
              </div>
            )}
            {leaveError && (
              <span className="active-room-banner__error" role="alert">
                {leaveError}
              </span>
            )}
          </aside>
        )}

        <main id="main-content">{children}</main>

        <SiteFooter />
      </div>
    </SoundContext.Provider>
  );
}
