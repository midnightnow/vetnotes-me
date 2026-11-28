/**
 * Clinical import URL parameter parsing (Red Team L7).
 *
 * Clinical findings passed between Vetsorcery Imaging and VetNotes should travel
 * in the URL hash fragment (`#source=imaging&package=...`) rather than the query
 * string (`?source=imaging&package=...`), because fragments are never transmitted
 * to HTTP servers, CDN access logs, proxies, or `Referer` headers.
 *
 * Reads the hash fragment first and falls back to `window.location.search` for
 * backward compatibility with older links during rollout.
 */

export interface ClinicalImportParams {
  source: string | null;
  encodedPackage: string | null;
  returnUrl: string | null;
}

function parseParams(raw: string): URLSearchParams {
  return new URLSearchParams(raw.replace(/^[#?]+/, ''));
}

export function readClinicalImportParams(search: string, hash: string): ClinicalImportParams {
  const hashParams = hash ? parseParams(hash) : new URLSearchParams();
  const searchParams = search ? parseParams(search) : new URLSearchParams();

  const source = hashParams.get('source') || searchParams.get('source');
  const encodedPackage = hashParams.get('package') || searchParams.get('package');
  const returnUrl = hashParams.get('returnUrl') || searchParams.get('returnUrl');

  return { source, encodedPackage, returnUrl };
}

/**
 * Returns a sanitized relative URL (`pathname + remaining search + remaining hash`)
 * with clinical import parameters removed from both query string and hash fragment.
 */
export function cleanClinicalImportUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('source');
  url.searchParams.delete('package');
  url.searchParams.delete('returnUrl');

  if (url.hash) {
    const hashParams = parseParams(url.hash);
    if (hashParams.has('source') || hashParams.has('package') || hashParams.has('returnUrl')) {
      hashParams.delete('source');
      hashParams.delete('package');
      hashParams.delete('returnUrl');
      const remaining = hashParams.toString();
      url.hash = remaining ? `#${remaining}` : '';
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
