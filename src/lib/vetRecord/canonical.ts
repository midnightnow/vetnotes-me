/* VENDORED from midnightnow/vetsorcery packages/functions/src/lib/vetRecord/canonical.ts @ ee5677fa (PR #135).
   Change it there first and re-copy; reader.test.ts checks this copy against core's example file. */
/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) for the values a record holds:
 * object keys sorted by UTF-16 code units, no whitespace, strings and numbers
 * serialised the way ECMAScript JSON.stringify does (which is what JCS
 * specifies). `undefined` members are dropped, as JSON.stringify drops them.
 *
 * Pure and dependency-free so the extension and VetNotes can compute the same
 * bytes; the digest itself is in seal.ts.
 */

export class CanonicalizationError extends Error {}

export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new CanonicalizationError(`Non-finite number ${value} cannot be canonicalised`);
      return JSON.stringify(value);
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(',')}]`;
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        throw new CanonicalizationError('Only plain objects can be canonicalised (convert Dates and Timestamps first)');
      }
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
    }
    default:
      throw new CanonicalizationError(`A ${typeof value} cannot be canonicalised`);
  }
}
