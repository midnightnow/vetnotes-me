/**
 * Legal constants shared by the pricing page, the checkout route and the
 * /terms, /privacy and /refunds pages.
 *
 * TERMS_VERSION names the text a buyer agrees to at checkout. The checkout
 * route records it, with the time, against the purchase. CHANGE IT WHENEVER
 * THE WORDING OF /terms OR /refunds CHANGES, so the record says which text
 * each vet agreed to.
 *
 * The current text is a DRAFT that has not been reviewed by the owner or a
 * lawyer (see the note at the top of each legal page). The version name says
 * so. Give the reviewed text a new version before it goes live.
 */
export const TERMS_VERSION = 'draft-2026-11-27';

/** The seller, as it must appear on the legal pages and the footer. */
export const SELLER_NAME = 'AIVA Pty Ltd';
export const SELLER_ABN = '85 693 383 292';

/** The support address the site already shows (SupportChat.svelte). */
export const SUPPORT_EMAIL = 'support@vetsorcery.com';
