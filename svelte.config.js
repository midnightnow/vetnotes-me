import adapterStatic from '@sveltejs/adapter-static';
import adapterNode from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// SSR migration: `SSR_BUILD=1` builds a Node SSR server (into build-ssr) so the
// server routes (CPD scoring, certificates, checkout, webhook) actually run.
// Default build stays static so existing deploy scripts remain safe until the
// SSR deploy path is validated on staging.
const useSSR = process.env.SSR_BUILD === '1';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: useSSR
			? adapterNode({ out: 'build-ssr' })
			: adapterStatic({ fallback: 'index.html' }),
		prerender: {
			handleHttpError: 'warn',
			handleUnseenRoutes: 'ignore'
		}
	}
};

export default config;
