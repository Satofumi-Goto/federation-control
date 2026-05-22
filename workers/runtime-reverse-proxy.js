export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = resolveRuntimeTarget(url);

    if (!target) {
      return new Response('Runtime reverse proxy route not found', { status: 404 });
    }

    const upstream = new URL(target.baseUrl);
    upstream.pathname = rewritePath(url.pathname, target.prefix);
    upstream.search = url.search;

    if (!upstream.searchParams.has('runtime_embed')) {
      upstream.searchParams.set('runtime_embed', 'grafana');
    }

    const headers = new Headers(request.headers);
    headers.set('host', upstream.host);
    headers.set('x-runtime-federation-proxy', 'true');
    headers.set('x-runtime-surface', target.name);

    const proxied = new Request(upstream.toString(), {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });

    const response = await fetch(proxied);
    const outHeaders = new Headers(response.headers);

    outHeaders.delete('x-frame-options');
    outHeaders.delete('content-security-policy');
    outHeaders.set('x-runtime-federation-proxy', 'true');
    outHeaders.set('cache-control', 'no-store');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  },
};

function resolveRuntimeTarget(url) {
  const routes = [
    {
      prefix: '/runtime/fleet',
      name: 'fleet',
      baseUrl: 'https://fleet-operations-console.base44.app',
    },
    {
      prefix: '/runtime/service-hub',
      name: 'service-hub',
      baseUrl: 'https://service-hub-console.base44.app',
    },
    {
      prefix: '/runtime/life',
      name: 'life',
      baseUrl: 'https://life-ledger-link.base44.app',
    },
    {
      prefix: '/runtime/urban',
      name: 'urban',
      baseUrl: 'https://urban-operation-console.base44.app',
    },
  ];

  return routes.find((route) => url.pathname === route.prefix || url.pathname.startsWith(`${route.prefix}/`));
}

function rewritePath(pathname, prefix) {
  const rest = pathname.slice(prefix.length);
  return rest || '/';
}
