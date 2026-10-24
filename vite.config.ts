import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		host: '0.0.0.0',
		port: 3000,
		allowedHosts: true
	},
	build: {
		rollupOptions: {
			// vetsorcery-imaging is loaded dynamically at runtime only.
			// Mark as external so Rollup doesn't try to resolve it at build time.
			external: ['vetsorcery-imaging'],
		},
	},
});
