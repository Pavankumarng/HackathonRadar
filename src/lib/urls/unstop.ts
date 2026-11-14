/**
 * Normalize a Unstop opportunity link to its public event-detail URL.
 *
 * Unstop listing responses can return path-like values that already contain
 * the "hackathons/" collection prefix more than once. Keep exactly one prefix
 * and reject homepage, API and off-site URLs.
 */
export function normalizeUnstopEventUrl(raw: string | null | undefined): string | null {
  const candidate = raw?.trim();
  if (!candidate) return null;

  try {
    let url: URL;

    if (/^https?:\/\//i.test(candidate) || candidate.startsWith('//')) {
      url = new URL(candidate, 'https://unstop.com');
    } else if (candidate.startsWith('/')) {
      url = new URL(candidate, 'https://unstop.com');
    } else if (/^(?:www\.)?unstop\.com\//i.test(candidate)) {
      url = new URL(`https://${candidate}`);
    } else if (candidate.startsWith('hackathons/')) {
      url = new URL(`/${candidate}`, 'https://unstop.com');
    } else if (/^[a-z0-9]+(?:-+[a-z0-9]+)*$/i.test(candidate)) {
      url = new URL(`/hackathons/${candidate}`, 'https://unstop.com');
    } else {
      return null;
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.hostname !== 'unstop.com' && url.hostname !== 'www.unstop.com') return null;

    // Collapse duplicate collection prefixes:
    // /hackathons/hackathons/<slug> -> /hackathons/<slug>
    url.pathname = url.pathname.replace(/^\/(?:hackathons\/)+/i, '/hackathons/');
    url.hostname = 'unstop.com';
    url.protocol = 'https:';
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '');

    // An event URL must have a slug after the collection path.
    const eventPath = url.pathname.match(/^\/hackathons\/([^/]+)$/i);
    if (!eventPath || !/^[a-z0-9]+(?:-+[a-z0-9]+)*$/i.test(eventPath[1])) return null;

    return url.toString();
  } catch {
    return null;
  }
}
