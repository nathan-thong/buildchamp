import { describe, expect, it } from 'vitest';

import { getPreviewState, parseRoute } from './routes';

describe('parseRoute', () => {
  it('recognizes the home and solo routes', () => {
    expect(parseRoute('/')).toEqual({ kind: 'home' });
    expect(parseRoute('/solo')).toEqual({ kind: 'solo' });
    expect(parseRoute('/solo/')).toEqual({ kind: 'solo' });
  });

  it('keeps the result payload opaque while decoding URL-safe segments', () => {
    expect(parseRoute('/build/demo')).toEqual({ kind: 'result', payload: 'demo' });
    expect(parseRoute('/build/hello%20world')).toEqual({
      kind: 'result',
      payload: 'hello world',
    });
  });

  it('falls back to not-found for unknown paths and incomplete result routes', () => {
    expect(parseRoute('/build/')).toEqual({ kind: 'not-found' });
    expect(parseRoute('/settings')).toEqual({ kind: 'not-found' });
    expect(parseRoute('/build/demo/extra')).toEqual({ kind: 'not-found' });
  });
});

describe('getPreviewState', () => {
  it('only accepts the explicit foundation preview states', () => {
    expect(getPreviewState('?preview=loading')).toBe('loading');
    expect(getPreviewState('?preview=fatal')).toBe('fatal');
    expect(getPreviewState('?preview=other')).toBeNull();
    expect(getPreviewState('')).toBeNull();
  });
});
