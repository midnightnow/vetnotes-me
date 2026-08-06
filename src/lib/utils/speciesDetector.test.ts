import { describe, it, expect } from 'vitest';
import { detectSpecies, shouldShowCard } from './speciesDetector';

describe('detectSpecies — substring regressions', () => {
	// These are the exact strings that broke the previous `includes("cat")`
	// implementation. Every one of them flipped a dog consultation to feline.
	it.each([
		'Ten year old Labrador, dental surgery is indicated.',
		'The dog has post-op complications.',
		'Dedicated owner, dog presented for vomiting.',
		'Bloods indicated for this Rottweiler.',
		'Golden retriever, education provided to owner.',
		'Vaccination due for this beagle.'
	])('does not read "cat" out of a word: %s', (text) => {
		expect(detectSpecies(text)).toBe('canine');
	});

	it('does not match "cat" inside "indicated" even with no other species word', () => {
		expect(detectSpecies('Surgery is indicated.')).toBe('unknown');
	});
});

describe('detectSpecies — breed vocabulary', () => {
	it.each([
		['Persian, 4kg, owner reports it chewed on a lily this morning.', 'feline'],
		['Domestic shorthair ingested lily petals, vomiting.', 'feline'],
		['Ragdoll in cardiac arrest, starting CPR.', 'feline'],
		['Maine coon presented for weight loss.', 'feline'],
		['Kelpie with a limp.', 'canine'],
		['Cavoodle ate chocolate.', 'canine'],
		['Border collie, lame left fore.', 'canine']
	])('resolves breed %s', (text, expected) => {
		expect(detectSpecies(text)).toBe(expected);
	});

	it('prefers the longer breed term over a shorter substring word', () => {
		// "cattle dog" must not be shortened to "cat".
		expect(detectSpecies('Australian cattle dog, 22kg.')).toBe('canine');
	});
});

describe('detectSpecies — never guesses', () => {
	it('returns unknown with no evidence', () => {
		expect(detectSpecies('Patient presented for a routine check.')).toBe('unknown');
	});

	it('returns unknown on empty input', () => {
		expect(detectSpecies('')).toBe('unknown');
	});

	it('returns unknown when both species are named', () => {
		expect(detectSpecies('The dog attacked the cat.')).toBe('unknown');
	});

	it('does not default to canine', () => {
		// The old module-level default was "canine"; absence must never mean dog.
		expect(detectSpecies('4kg, bright and alert.')).not.toBe('canine');
	});
});

describe('detectSpecies — explicit words still work', () => {
	it.each([
		['cat', 'feline'],
		['Cat presented for inappetence.', 'feline'],
		['feline patient, 5kg', 'feline'],
		['dog', 'canine'],
		['canine patient', 'canine'],
		['Puppy, 12 weeks, first vaccination.', 'canine']
	])('%s', (text, expected) => {
		expect(detectSpecies(text)).toBe(expected);
	});
});

describe('shouldShowCard — unknown must never suppress a safety card', () => {
	it('shows a feline toxicity card when species is unknown', () => {
		// The lily card was the one suppressed for "Persian ... lily".
		expect(shouldShowCard(['feline'], 'unknown')).toBe(true);
	});

	it('shows a canine toxicity card when species is unknown', () => {
		expect(shouldShowCard(['canine'], 'unknown')).toBe(true);
	});

	it('filters correctly once species is known', () => {
		expect(shouldShowCard(['feline'], 'canine')).toBe(false);
		expect(shouldShowCard(['feline'], 'feline')).toBe(true);
	});

	it('always shows untagged cards', () => {
		expect(shouldShowCard(undefined, 'canine')).toBe(true);
		expect(shouldShowCard([], 'feline')).toBe(true);
	});
});

describe('end-to-end: the two dangerous scenarios', () => {
	const LILY = { species: ['feline'] };
	const CHOC = { species: ['canine'] };

	it('a cat that ate a lily still gets the lily card', () => {
		const s = detectSpecies('Persian, 4kg, owner reports it chewed on a lily this morning.');
		expect(s).toBe('feline');
		expect(shouldShowCard(LILY.species, s)).toBe(true);
	});

	it('an unidentified patient that ate a lily still gets the lily card', () => {
		const s = detectSpecies('4kg, chewed on a lily this morning.');
		expect(s).toBe('unknown');
		expect(shouldShowCard(LILY.species, s)).toBe(true);
	});

	it('a Labrador that ate chocolate still gets the chocolate card despite "indicated"', () => {
		const s = detectSpecies('Labrador ate chocolate, surgery may be indicated.');
		expect(s).toBe('canine');
		expect(shouldShowCard(CHOC.species, s)).toBe(true);
	});
});
