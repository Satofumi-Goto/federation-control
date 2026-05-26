/**
 * Runtime Routing Resolver — translates registry target → href + targetMode.
 * No window.location / window.open — output is <a> props only.
 */

export function resolveRuntimeTarget(target) {
  if (!target) {
    return { href: '/', targetMode: '_self' };
  }

  switch (target.type) {
    case 'grafana-runtime':
    case 'grafana-dashboard':
      return { href: target.url, targetMode: '_top' };

    case 'base44-viewer':
      return {
        href: `${target.url}${target.url.includes('?') ? '&' : '?'}runtime_embed=grafana&public_view=1`,
        targetMode: '_top',
      };

    case 'seneschal':
      return { href: target.url, targetMode: '_top' };

    case 'internal-runtime':
      return { href: target.url, targetMode: '_self' };

    default:
      return { href: target.url || '/', targetMode: '_self' };
  }
}
