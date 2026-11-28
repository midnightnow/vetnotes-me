/**
 * The /terms, /refunds and /privacy pages are DRAFTS awaiting the owner's and a
 * lawyer's review. Until then these tests hold them to the facts that have been
 * confirmed, and fail if a draft starts promising something nobody decided.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Terms from './terms/+page.svelte';
import Refunds from './refunds/+page.svelte';
import Privacy from './privacy/+page.svelte';
import SiteFooter from '$lib/components/SiteFooter.svelte';
import { SUPPORT_EMAIL, TERMS_VERSION } from '$lib/constants/legal';

let app: ReturnType<typeof mount> | null = null;

function render(component: any): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	app = mount(component, { target });
	flushSync();
	return target;
}
const textOf = (el: HTMLElement) => (el.textContent || '').replace(/\s+/g, ' ');

afterEach(() => {
	if (app) unmount(app);
	app = null;
	document.body.innerHTML = '';
});

const PAGES = [
	['terms', Terms],
	['refunds', Refunds],
	['privacy', Privacy]
] as const;

describe('legal pages', () => {
	for (const [name, component] of PAGES) {
		it(`/${name} names the seller and gives the support address`, () => {
			const el = render(component);
			const text = textOf(el);
			expect(text).toContain('AIVA Pty Ltd');
			expect(text).toContain('ABN 85 693 383 292');
			expect(el.querySelector(`a[href="mailto:${SUPPORT_EMAIL}"]`)).not.toBeNull();
		});

		it(`/${name} states nothing that is still undecided`, () => {
			const text = textOf(render(component));
			// GST treatment, refund windows, guarantees, uptime, governing law,
			// phone numbers and street addresses are all undecided or unknown.
			expect(text).not.toMatch(/\bGST\b/i);
			expect(text).not.toMatch(/\b\d+\s*(business\s+)?(day|days|hours?)\b/i);
			expect(text).not.toMatch(/guarantee|money[- ]back|uptime|\bSLA\b/i);
			expect(text).not.toMatch(/governing law|jurisdiction|courts? of/i);
			expect(text).not.toMatch(/New South Wales|Queensland|Victoria|Tasmania|South Australia|Western Australia|Northern Territory|\bNSW\b|\bQLD\b/);
			expect(text).not.toMatch(/(\+61|\(0\d\)|\b0\d)[\d\s]{8,}/);
		});
	}

	it('/terms and /refunds state the confirmed billing and cancellation facts', () => {
		for (const component of [Terms, Refunds]) {
			const text = textOf(render(component));
			expect(text).toContain('A$49 per month');
			expect(text).toContain('monthly in advance');
			expect(text).toMatch(/renews each month until you cancel/);
			expect(text).toContain('Manage subscription');
			expect(text).toMatch(/stays active until the end of the period you have already paid for/);
			expect(text).toMatch(/Nothing in (these terms|this policy) excludes, restricts or modifies any right or remedy you have under the Australian Consumer Law/);
			expect(text).toContain(`Version: ${TERMS_VERSION}`);
			if (app) unmount(app);
			app = null;
		}
	});

	it('the footer links to all three pages and shows the seller', () => {
		const el = render(SiteFooter);
		for (const href of ['/terms', '/refunds', '/privacy']) {
			expect(el.querySelector(`a[href="${href}"]`), href).not.toBeNull();
		}
		expect(textOf(el)).toContain('AIVA Pty Ltd · ABN 85 693 383 292');
	});
});
