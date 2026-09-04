import { useEffect, useState } from 'react';

import { AppShell } from './components/AppShell';
import { LoadingState } from './components/StatePanels';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ResultPage } from './pages/ResultPage';
import { SoloDraftPage } from './pages/SoloDraftPage';
import { getPreviewState, parseRoute, readAppLocation, type AppLocation } from './lib/routes';

function useBrowserLocation(): AppLocation {
  const [location, setLocation] = useState<AppLocation>(() => readAppLocation(window.location));

  useEffect(() => {
    function handleLocationChange() {
      setLocation(readAppLocation(window.location));
    }

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  return location;
}

function pageTitle(routeKind: ReturnType<typeof parseRoute>['kind']): string {
  switch (routeKind) {
    case 'solo':
      return 'Solo draft — BuildChamp';
    case 'result':
      return 'Shared result — BuildChamp';
    case 'not-found':
      return 'Not found — BuildChamp';
    case 'home':
      return 'BuildChamp — Six-slot champion draft';
  }
}

export function App() {
  const location = useBrowserLocation();
  const previewState = getPreviewState(location.search);
  const route = parseRoute(location.pathname);

  useEffect(() => {
    document.title = pageTitle(route.kind);
  }, [route.kind]);

  if (previewState === 'fatal') {
    throw new Error('Fatal state preview requested.');
  }

  if (previewState === 'loading') {
    return (
      <AppShell currentRoute={route.kind}>
        <div className="page-container">
          <LoadingState />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell currentRoute={route.kind}>
      {route.kind === 'home' && <HomePage />}
      {route.kind === 'solo' && <SoloDraftPage />}
      {route.kind === 'result' && <ResultPage payload={route.payload} />}
      {route.kind === 'not-found' && <NotFoundPage />}
    </AppShell>
  );
}
