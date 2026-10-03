import { afterEach, describe, expect, it } from 'vitest';
import {
	isProductionAnalyticsHost,
	shouldLoadAnalytics,
	shouldLoadAnalyticsInBrowser
} from './analyticsHost';

// GA4 (G-5RMHPMWWLZ) must only see real visitors on the production hosts.

describe('isProductionAnalyticsHost', () => {
	it('allows the production hosts', () => {
		for (const h of ['vetnotes.me', 'www.vetnotes.me', 'vetnotes.pro', 'www.vetnotes.pro', 'VetNotes.me', 'vetnotes.me.']) {
			expect(isProductionAnalyticsHost(h), h).toBe(true);
		}
	});

	it('never loads on dev, the Cloud Run URL, other sites or look-alikes', () => {
		for (const h of [
			'localhost',
			'127.0.0.1',
			'[::1]',
			'0.0.0.0',
			'vetnotes-me-abc123-ts.a.run.app',
			'vetnotes-pro.web.app',
			'vetsorcery.com',
			'vetnotes.me.evil.io',
			'evilvetnotes.me',
			'staging.vetnotes.me',
			'',
			undefined,
			null
		]) {
			expect(isProductionAnalyticsHost(h), String(h)).toBe(false);
		}
	});
});

describe('shouldLoadAnalytics', () => {
	it('stays dark under browser automation even on the production host', () => {
		expect(shouldLoadAnalytics({ hostname: 'vetnotes.me', webdriver: true })).toBe(false);
		expect(shouldLoadAnalytics({ hostname: 'vetnotes.me', webdriver: false })).toBe(true);
		expect(shouldLoadAnalytics({ hostname: 'vetnotes.me' })).toBe(true);
		expect(shouldLoadAnalytics({ hostname: 'localhost', webdriver: false })).toBe(false);
	});
});

describe('shouldLoadAnalyticsInBrowser', () => {
	const g = globalThis as { window?: unknown };
	afterEach(() => {
		delete g.window;
	});

	it('reads window.location and navigator.webdriver', () => {
		expect(shouldLoadAnalyticsInBrowser()).toBe(false);
		g.window = { location: { hostname: 'vetnotes.me' }, navigator: { webdriver: false } };
		expect(shouldLoadAnalyticsInBrowser()).toBe(true);
		g.window = { location: { hostname: 'vetnotes.me' }, navigator: { webdriver: true } };
		expect(shouldLoadAnalyticsInBrowser()).toBe(false);
		g.window = { location: { hostname: '127.0.0.1' }, navigator: { webdriver: false } };
		expect(shouldLoadAnalyticsInBrowser()).toBe(false);
	});
});
