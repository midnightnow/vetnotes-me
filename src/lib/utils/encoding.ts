/**
 * URL-safe Base64 encoding/decoding for clinical data packages.
 */

export function encodePayload(obj: unknown): string {
  const jsonString = JSON.stringify(obj);
  const utf8Bytes = new TextEncoder().encode(jsonString);
  const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
  return btoa(binaryString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decodePayload<T = unknown>(encoded: string): T {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const jsonString = new TextDecoder().decode(bytes);
  return JSON.parse(jsonString) as T;
}
