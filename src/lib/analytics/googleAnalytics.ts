/**
 * Google Analytics 4 for vetnotes.me
 *
 * Why this exists: as of 2026-08-11 the served HTML for vetnotes.me contained no
 * analytics tag of any kind — no gtag.js, no GTM container. Every session was
 * invisible, which is why the GA property reported "No data received from your
 * website or app yet".
 *
 * The measurement id is public by design — it is visible in any browser's page
 * source. It is read from the environment so staging/preview builds can point at
 * a throwaway property, or leave it unset and stay out of production data.
 *
 * Set VITE_GA_MEASUREMENT_ID to override. Set it to an empty string to disable
 * every function here.
 */

import { shouldLoadAnalyticsInBrowser } from './analyticsHost';

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID ?? 'G-5RMHPMWWLZ';

type GaParams = Record<string, unknown>;

declare global {
	interface Window {
		dataLayer?: unknown[];
		gtag?: (...args: unknown[]) => void;
	}
}

let initialised = false;

/** True when a measurement id is configured and a real visitor is on a production host (analyticsHost.ts). */
export function gaEnabled(): boolean {
	return typeof window !== 'undefined' && MEASUREMENT_ID !== '' && shouldLoadAnalyticsInBrowser();
}

export function getMeasurementId(): string {
	return MEASUREMENT_ID;
}

/**
 * Inject gtag.js and fire the first page_view.
 * Safe to call more than once — subsequent calls are ignored.
 */
export function initGoogleAnalytics(): void {
	if (initialised || !gaEnabled()) return;
	initialised = true;

	window.dataLayer = window.dataLayer || [];
	/* gtag pushes `arguments` itself — not a spread array. GA's own processing
	   depends on receiving the arguments object, so this cannot be simplified
	   to (...args) => window.dataLayer.push(args). */
	function gtag() {
		// eslint-disable-next-line prefer-rest-params
		window.dataLayer?.push(arguments);
	}
	window.gtag = gtag as unknown as Window['gtag'];

	const script = document.createElement('script');
	script.async = true;
	script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
	document.head.appendChild(script);

	window.gtag?.('js', new Date());
	/* send_page_view stays on so the landing hit is recorded even if the visitor
	   never navigates. Subsequent SPA routes come through trackGaPageView. */
	window.gtag?.('config', MEASUREMENT_ID, { send_page_view: true });
}

/**
 * Fire a page_view. SvelteKit is a client-routed SPA, so a route change causes
 * no browser navigation — without this only the landing page of a session would
 * ever be counted.
 */
export function trackGaPageView(path?: string): void {
	if (!gaEnabled()) return;
	window.gtag?.('event', 'page_view', {
		page_path: path ?? window.location.pathname,
		page_location: window.location.href,
		page_title: document.title
	});
}

/** An arbitrary GA4 event. */
export function trackGaEvent(event: string, params: GaParams = {}): void {
	if (!gaEnabled()) return;
	window.gtag?.('event', event, params);
}

/**
 * Fire only when a real contact detail has been captured or a real enquiry has
 * been sent — never on a page view or a button hover.
 */
export function trackGaLead(params: GaParams = {}): void {
	trackGaEvent('generate_lead', params);
}
