import { useEffect, useRef, useState, type ReactNode } from 'react';

import type { AppRoute } from '../lib/routes';
import { readPreferences, writePreferences } from '../lib/preferences';
import { createSoundController, SoundContext, type SoundController } from '../lib/sound';
import { AppLink } from './AppLink';
import { BrandMark } from './BrandMark';
import { MuteControl } from './MuteControl';

type AppShellProps = {
  readonly children: ReactNode;
  readonly currentRoute: AppRoute['kind'];
  readonly storage?: Storage;
};

function navClass(isCurrent: boolean): string {
  return `site-nav__link ${isCurrent ? 'site-nav__link--current' : ''}`.trim();
}

export function AppShell({ children, currentRoute, storage }: AppShellProps) {
  const [muted, setMuted] = useState(() => readPreferences(storage).muted);
  const soundControllerRef = useRef<SoundController | null>(null);

  if (!soundControllerRef.current) {
    soundControllerRef.current = createSoundController({ muted });
  }

  const soundController = soundControllerRef.current;

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
            </nav>

            <MuteControl muted={muted} onToggle={() => setMuted((current) => !current)} />
          </div>
        </header>

        <main id="main-content">{children}</main>

        <footer className="site-footer">
          <div className="site-footer__inner">
            <div className="site-footer__brand">
              <BrandMark className="site-footer__mark" />
              <span>BuildChamp</span>
            </div>
            <p className="site-footer__notice">
              Unofficial fan project. Not endorsed by Riot Games. Riot Games and associated
              properties are trademarks or registered trademarks of Riot Games, Inc.
            </p>
          </div>
        </footer>
      </div>
    </SoundContext.Provider>
  );
}
