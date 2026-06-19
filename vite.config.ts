import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		rollupOptions: {
			// vetsorcery-imaging is loaded dynamically at runtime only.
			// Mark as external so Rollup doesn't try to resolve it at build time.
			external: ['vetsorcery-imaging'],
		},
	},
});
