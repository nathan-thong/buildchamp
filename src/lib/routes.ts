export type AppRoute =
  | { readonly kind: 'home' }
  | { readonly kind: 'solo' }
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
