export type AppRoute =
  | { readonly kind: 'home' }
  | { readonly kind: 'solo' }
  | { readonly kind: 'lobby' }
  | { readonly kind: 'room'; readonly roomCode: string }
  | { readonly kind: 'display'; readonly roomCode: string }
  | { readonly kind: 'result'; readonly payload: string }
  | { readonly kind: 'not-found' };

export type PreviewState = 'loading' | 'fatal' | null;

export type AppLocation = {
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
};

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function parseRoute(pathname: string): AppRoute {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';

  if (normalizedPath === '/') {
    return { kind: 'home' };
  }

  if (normalizedPath === '/solo') {
    return { kind: 'solo' };
  }

  if (normalizedPath === '/lobby') {
    return { kind: 'lobby' };
  }

  const roomMatch = normalizedPath.match(/^\/(room|display)\/([^/]+)$/iu);
  if (roomMatch) {
    const roomCode = decodeSegment(roomMatch[2] ?? '');
    if (/^[A-HJ-NP-Z2-9]{6}$/iu.test(roomCode)) {
      return roomMatch[1]?.toLowerCase() === 'display'
        ? { kind: 'display', roomCode: roomCode.toUpperCase() }
        : { kind: 'room', roomCode: roomCode.toUpperCase() };
    }
  }

  const resultMatch = normalizedPath.match(/^\/build\/([^/]+)$/);
  if (resultMatch) {
    return { kind: 'result', payload: decodeSegment(resultMatch[1]) };
  }

  return { kind: 'not-found' };
}

export function getPreviewState(search: string): PreviewState {
  const params = new URLSearchParams(search);
  const value = params.get('preview');

  if (value === 'loading' || value === 'fatal') {
    return value;
  }

  return null;
}

export function readAppLocation(
  location: Pick<Location, 'pathname' | 'search' | 'hash'>,
): AppLocation {
  return {
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
  };
}
