/**
 * Species detection for the clinical reference sidebar.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * The previous implementation lived inline in ReferenceSidebar.svelte and was:
 *
 *     if (lowerText.includes("cat") || lowerText.includes("feline")) species = "feline";
 *     else if (lowerText.includes("dog") || lowerText.includes("canine")) species = "canine";
 *
 * `String.includes` is a SUBSTRING test, so ordinary clinical language flipped the
 * species: "indi(cat)ed", "compli(cat)ions", "dedi(cat)ed", "edu(cat)ion" all match
 * "cat". Breed names were never consulted at all, and the state defaulted to
 * "canine", so a cat whose species was never spoken silently presented as a dog.
 *
 * That mattered because the sidebar filters species-specific toxicity and
 * resuscitation cards. Observed failures: "Persian, 4kg, chewed on a lily"
 * suppressed the lily card entirely (lily = acute kidney injury, the key feline
 * toxin); "Ragdoll in cardiac arrest" offered the CANINE CPR protocol.
 *
 * DESIGN RULES
 * ------------
 * 1. Match whole words only, never substrings.
 * 2. Consult breed vocabulary, not just the words "cat"/"dog".
 * 3. Never default. Absence of evidence is `unknown`, not `canine`.
 * 4. Ambiguous evidence (both species named) resolves to `unknown`, not a guess.
 *
 * The caller is responsible for the safety behaviour on `unknown`: show cards for
 * BOTH species rather than suppressing them. Suppressing a toxicity alert is the
 * dangerous failure mode; showing one extra labelled card is not.
 */

export type DetectedSpecies = 'canine' | 'feline' | 'unknown';

/** Whole-word feline vocabulary, including common breeds. */
const FELINE_TERMS = [
	'cat',
	'cats',
	'feline',
	'kitten',
	'kittens',
	'queen',
	'tomcat',
	'moggy',
	'dsh',
	'dlh',
	'domestic shorthair',
	'domestic longhair',
	'persian',
	'siamese',
	'ragdoll',
	'maine coon',
	'bengal',
	'burmese',
	'birman',
	'sphynx',
	'abyssinian',
	'russian blue',
	'british shorthair',
	'norwegian forest',
	'devon rex',
	'cornish rex',
	'oriental shorthair',
	'tonkinese',
	'scottish fold'
];

/** Whole-word canine vocabulary, including common breeds. */
const CANINE_TERMS = [
	'dog',
	'dogs',
	'canine',
	'puppy',
	'puppies',
	'pup',
	'bitch',
	'labrador',
	'lab',
	'retriever',
	'golden retriever',
	'german shepherd',
	'alsatian',
	'poodle',
	'bulldog',
	'beagle',
	'rottweiler',
	'dachshund',
	'boxer',
	'chihuahua',
	'pug',
	'husky',
	'malamute',
	'greyhound',
	'whippet',
	'staffy',
	'staffordshire',
	'terrier',
	'jack russell',
	'border collie',
	'collie',
	'kelpie',
	'cattle dog',
	'spaniel',
	'cocker spaniel',
	'cavoodle',
	'labradoodle',
	'groodle',
	'schnauzer',
	'shih tzu',
	'maltese',
	'pomeranian',
	'corgi',
	'dalmatian',
	'doberman',
	'great dane',
	'mastiff',
	'akita',
	'shiba',
	'weimaraner',
	'vizsla',
	'pointer',
	'setter'
];

/**
 * Escape a term for safe embedding in a RegExp.
 * Terms are literals from the lists above, but this keeps the builder total.
 */
function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a whole-word matcher for a vocabulary list.
 *
 * `\b` on both sides is what fixes the original defect: `\bcat\b` does not match
 * "indicated". Multi-word breeds ("maine coon") work because \b anchors the outer
 * edges only and the internal space is matched literally.
 */
function buildMatcher(terms: string[]): RegExp {
	// Longest-first so "cattle dog" is preferred over "cat" during alternation.
	const ordered = [...terms].sort((a, b) => b.length - a.length);
	return new RegExp(`\\b(?:${ordered.map(escapeRegExp).join('|')})\\b`, 'i');
}

const FELINE_RE = buildMatcher(FELINE_TERMS);
const CANINE_RE = buildMatcher(CANINE_TERMS);

/**
 * Detect species from consultation narrative.
 *
 * Returns `unknown` when there is no evidence, or when both species are named
 * (e.g. "the dog attacked the cat") — an ambiguous transcript must not silently
 * pick one.
 */
export function detectSpecies(text: string): DetectedSpecies {
	if (!text) return 'unknown';

	const isFeline = FELINE_RE.test(text);
	const isCanine = CANINE_RE.test(text);

	if (isFeline && isCanine) return 'unknown';
	if (isFeline) return 'feline';
	if (isCanine) return 'canine';
	return 'unknown';
}

/**
 * Should a species-tagged reference card be shown, given the current species?
 *
 * On `unknown` this returns true for every card. That is deliberate: the cards are
 * individually labelled ("CPR Protocol (Feline)"), so showing both is legible,
 * whereas hiding the lily card from a cat is a clinical-safety failure.
 */
export function shouldShowCard(
	cardSpecies: string[] | undefined,
	current: DetectedSpecies
): boolean {
	if (!cardSpecies || cardSpecies.length === 0) return true;
	if (current === 'unknown') return true;
	return cardSpecies.includes(current);
}
