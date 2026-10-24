/**
 * Where Google Analytics may run (googleAnalytics.ts gates gaEnabled() on this).
 *
 * Until 2026-10-03 GA loaded on ANY host — the measurement id has a hardcoded
 * fallback — so `vite dev`, the Cloud Run service URL, previews and every
 * Playwright run reported into the production GA4 property (G-5RMHPMWWLZ,
 * shared with vetsorcery.com). Probe 2026-10-03: an automated visit to
 * https://vetnotes.me/ sent a page_view.
 *
 * Same rule as vetsorcery-core frontend/src/lib/analyticsHost.ts:
 * - exact-match allow-list (the *.run.app service URL stays dark);
 * - never under automation: Playwright/Puppeteer/Selenium set
 *   navigator.webdriver = true, real visitors' browsers do not.
 */
export const ANALYTICS_PRODUCTION_HOSTS: ReadonlySet<string> = new Set([
	'vetnotes.me',
	'www.vetnotes.me',
	'vetnotes.pro',
	'www.vetnotes.pro'
]);

export function isProductionAnalyticsHost(hostname: string | null | undefined): boolean {
	if (!hostname) return false;
	return ANALYTICS_PRODUCTION_HOSTS.has(hostname.toLowerCase().replace(/\.$/, ''));
}

export function shouldLoadAnalytics(env: { hostname?: string | null; webdriver?: boolean }): boolean {
	return env.webdriver !== true && isProductionAnalyticsHost(env.hostname);
}

/** Browser-side check. Always false during SSR (no window). */
export function shouldLoadAnalyticsInBrowser(): boolean {
	if (typeof window === 'undefined') return false;
	return shouldLoadAnalytics({
		hostname: window.location.hostname,
		webdriver: window.navigator?.webdriver
	});
}
