#!/usr/bin/env node
/**
 * Fail loudly if the AIVET SDK dependency does not resolve.
 *
 * WHY
 * ---
 * `package.json` declared `"@vetsorcery/sdk": "file:../../SDK/packages/typescript"`,
 * which resolved to `<repo>/../../SDK/...` — a path that has not existed since
 * this repo moved out of `VET-ECOSYSTEM/Vetnotes/` on 2026-07-01. The move broke
 * the link and NOTHING complained, because:
 *
 *   - `npm install` exits 0 and silently SKIPS an unresolvable `file:` dependency
 *     (verified empirically: 511 packages added, @vetsorcery/sdk absent, exit 0);
 *   - the only two importers use `import type`, which Vite erases, so the bundle
 *     builds clean with the package missing entirely.
 *
 * The consequence was that every `VetDocument` / `SOAPData` / `Patient` annotation
 * in this app silently referred to nothing. The one mechanism that could have
 * caught schema drift against the SDK was switched off, and roughly half the
 * defects found in the 2026-08-05 review are writer/reader contract drifts that a
 * working typecheck would have flagged.
 *
 * A silent skip must never be the failure mode again. `npm run check` now runs
 * this first.
 *
 * NOTE: the SDK is intentionally absent inside the Cloud Run container build —
 * the Dockerfile copies only this repo, so the monorepo-relative path is out of
 * the build context and npm skips it there as before. That is fine: the imports
 * are type-only and erased. This guard is for developer and CI environments,
 * where the monorepo IS present and typechecking is supposed to mean something.
 * It therefore no-ops (with a notice) when the SDK directory is genuinely absent
 * because we are not in the monorepo.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));
const spec = pkg.dependencies?.['@vetsorcery/sdk'];

if (!spec) {
	console.error('✖ @vetsorcery/sdk is not declared in dependencies.');
	process.exit(1);
}

if (!spec.startsWith('file:')) {
	// A registry or git spec resolves through normal npm machinery; nothing to check.
	console.log(`✓ @vetsorcery/sdk uses a non-file spec (${spec}) — skipping path check.`);
	process.exit(0);
}

const target = resolve(repoRoot, spec.slice('file:'.length));

if (!existsSync(target)) {
	// Are we simply outside the monorepo (e.g. a container build)? Then this is
	// expected and not an error — but say so, rather than staying silent.
	const monorepoMarker = resolve(repoRoot, '../../VET-ECOSYSTEM');
	if (!existsSync(monorepoMarker)) {
		console.log(
			`ℹ @vetsorcery/sdk target not present (${target}) and the monorepo is not ` +
				`checked out here — expected outside the monorepo (type-only imports are erased).`
		);
		process.exit(0);
	}

	console.error('');
	console.error('✖ @vetsorcery/sdk does NOT resolve.');
	console.error('');
	console.error(`    declared : ${spec}`);
	console.error(`    resolves : ${target}`);
	console.error('    exists   : NO');
	console.error('');
	console.error('  npm exits 0 on an unresolvable file: dependency and silently skips it,');
	console.error('  and the type-only imports are erased by Vite — so the build would still');
	console.error('  succeed while every SDK type silently referred to nothing.');
	console.error('');
	console.error('  The SDK lives at VET-ECOSYSTEM/SDK/packages/typescript.');
	console.error('');
	process.exit(1);
}

// Present on disk. Also confirm it is actually installed, so `check` is honest
// about whether svelte-check can really see the types.
const require = createRequire(resolve(repoRoot, 'package.json'));
try {
	require.resolve('@vetsorcery/sdk');
	console.log(`✓ @vetsorcery/sdk resolves and is installed (${spec})`);
} catch {
	console.error('');
	console.error(`✖ @vetsorcery/sdk exists at ${target} but is NOT installed.`);
	console.error('  Run `npm install` — until then typechecking cannot see SDK types.');
	console.error('');
	process.exit(1);
}
