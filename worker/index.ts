type AssetsBinding = {
  fetch(input: Request | URL | string): Promise<Response>;
};

export type Env = {
  readonly ASSETS: AssetsBinding;
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data: https://ddragon.leagueoflegends.com https://raw.communitydragon.org",
} as const;

function isApplicationRoute(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/solo' ||
    pathname.startsWith('/build/') ||
    !pathname.includes('.')
  );
}

function isMissingStaticAsset(pathname: string, response: Response): boolean {
  if (isApplicationRoute(pathname) || pathname === '/index.html' || pathname === '/404.html') {
    return false;
  }

  return (
    response.status === 200 &&
    response.headers.get('Content-Type')?.split(';', 1)[0]?.toLowerCase() === 'text/html'
  );
}

function requestClass(pathname: string): 'application' | 'asset' | 'static' {
  if (isApplicationRoute(pathname)) {
    return 'application';
  }

  if (pathname.startsWith('/assets/')) {
    return 'asset';
  }

  return 'static';
}

function addResponseHeaders(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  if (response.status >= 400) {
    headers.set('Cache-Control', 'no-store');
  } else if (pathname.startsWith('/assets/')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (headers.get('Content-Type')?.startsWith('text/html')) {
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

async function notFoundResponse(request: Request, env: Env): Promise<Response> {
  const url = new URL('/404.html', request.url);
  const response = await env.ASSETS.fetch(new Request(url));
  return new Response(response.body, {
    headers: response.headers,
    status: 404,
    statusText: 'Not Found',
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startedAt = Date.now();
    const pathname = new URL(request.url).pathname;
    const route = requestClass(pathname);

    try {
      const assetResponse = await env.ASSETS.fetch(request);
      const response = isMissingStaticAsset(pathname, assetResponse)
        ? await notFoundResponse(request, env)
        : assetResponse;
      const finalResponse = addResponseHeaders(response, pathname);

      if (finalResponse.status >= 500) {
        console.error({
          event: 'asset_response_failure',
          route,
          status: finalResponse.status,
          durationMs: Date.now() - startedAt,
        });
      }

      return finalResponse;
    } catch {
      console.error({
        event: 'asset_request_failure',
        route,
        durationMs: Date.now() - startedAt,
      });

      return addResponseHeaders(
        new Response('BuildChamp is temporarily unavailable.', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          status: 503,
          statusText: 'Service Unavailable',
        }),
        pathname,
      );
    }
  },
};
