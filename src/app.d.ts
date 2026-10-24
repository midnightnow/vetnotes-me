// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: {
				uid: string;
				email?: string;
				displayName?: string;
			}
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module 'vetsorcery-imaging' {
	const content: any;
	export default content;
	export const Viewer: any;
}

export {};
