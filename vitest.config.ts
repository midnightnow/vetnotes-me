import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
    plugins: [sveltekit()],
    test: {
        include: ['src/**/*.{test,spec}.{js,ts}'],
        environment: 'jsdom',
        globals: true,
        // `src/lib/firebase.ts` calls getAuth() at module scope, so ANY test whose
        // import graph reaches it dies at load with `auth/invalid-api-key` unless a
        // key is present. Vitest runs in "test" mode and therefore never loads
        // `.env.production`, where the (public) web key lives — so `aiva.test.ts`
        // and `pipeline.test.ts` had never been runnable at all. That is precisely
        // why the fabricated-physical-exam defect in `services/aiva.ts` survived:
        // the file had a test suite that could not execute.
        //
        // A syntactically-valid dummy satisfies initialization. Nothing here makes
        // network calls; tests must stay hermetic. Do not put a real key here.
        env: {
            VITE_FIREBASE_API_KEY: 'AIzaSyTEST-not-a-real-key-hermetic-tests-only'
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'src/routes/**/*.svelte',
                '**/*.config.{js,ts}',
                '**/types.ts'
            ]
        }
    }
});
