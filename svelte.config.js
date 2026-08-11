import adapterNode from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		/* `out` must stay 'build-ssr': the Dockerfile's CMD is
		   `node build-ssr/index.js`. adapter-node defaults to 'build/', and when
		   the SSR_BUILD conditional was removed from this file the container
		   started failing its startup probe with
		   `Cannot find module '/app/build-ssr/index.js'` — which is why
		   vetnotes.me had not deployed since 2026-08-04. */
		adapter: adapterNode({ out: 'build-ssr' }),
		prerender: {
			handleHttpError: 'warn',
			handleUnseenRoutes: 'ignore'
		}
	}
};

export default config;
