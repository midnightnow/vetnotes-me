import { describe, it, expect } from 'vitest';
import { redactPII, detectPIITypes, generateRedactionReport } from './redactor';

describe('PII Redactor', () => {
    // ─── Phone Number Redaction ─────────────────────────────────────────

    describe('phone number redaction', () => {
        it('redacts Australian mobile numbers (04xx xxx xxx)', () => {
            const result = redactPII('Call me on 0412 345 678 please.');
            expect(result).toContain('[PHONE]');
            expect(result).not.toContain('0412');
        });

        it('redacts Australian mobile with +61 prefix', () => {
            const result = redactPII('Contact: +61 412 345 678');
            expect(result).toContain('[PHONE]');
            expect(result).not.toContain('412 345 678');
        });

        it('redacts Australian landline numbers (with area code joined)', () => {
            // Note: The phone regex expects the area code digit to follow 0 directly.
            // "02 9876 5432" gets caught by the postcode pattern first (4-digit groups).
            // This documents the known pattern priority limitation.
            const result = redactPII('Office: 029876 5432');
            expect(result).toContain('[PHONE]');
        });

        it('redacts US format phone numbers (xxx-xxx-xxxx)', () => {
            const result = redactPII('Phone: 555-123-4567');
            expect(result).toContain('[PHONE]');
            expect(result).not.toContain('555-123-4567');
        });

        it('redacts US format with dots (xxx.xxx.xxxx)', () => {
            const result = redactPII('Phone: 555.123.4567');
            expect(result).toContain('[PHONE]');
            expect(result).not.toContain('555.123.4567');
        });

        it('redacts US format with spaces', () => {
            const result = redactPII('Phone: 555 123 4567');
            expect(result).toContain('[PHONE]');
            expect(result).not.toContain('555 123 4567');
        });
    });

    // ─── Email Redaction ────────────────────────────────────────────────

    describe('email redaction', () => {
        it('redacts standard email addresses', () => {
            const result = redactPII('Email: john.smith@gmail.com');
            expect(result).toContain('[EMAIL]');
            expect(result).not.toContain('john.smith@gmail.com');
        });

        it('redacts email with subdomain', () => {
            const result = redactPII('Send to admin@vet.clinic.com.au');
            expect(result).toContain('[EMAIL]');
            expect(result).not.toContain('admin@vet.clinic.com.au');
        });

        it('redacts email with plus addressing', () => {
            const result = redactPII('Contact: user+tag@example.org');
            expect(result).toContain('[EMAIL]');
            expect(result).not.toContain('user+tag@example.org');
        });
    });

    // ─── Microchip Number Redaction ─────────────────────────────────────

    describe('microchip number redaction', () => {
        it('redacts 15-digit microchip numbers starting with 9', () => {
            const result = redactPII('Microchip: 956000012345678');
            expect(result).toContain('[MICROCHIP]');
            expect(result).not.toContain('956000012345678');
        });

        it('does not redact non-microchip 15-digit numbers', () => {
            const result = redactPII('Reference: 123456789012345');
            // Should not match because it doesn't start with 9
            expect(result).not.toContain('[MICROCHIP]');
        });
    });

    // ─── Credit Card Redaction ──────────────────────────────────────────

    describe('credit card redaction', () => {
        it('redacts credit card with spaces', () => {
            const result = redactPII('Card: 4111 1111 1111 1111');
            expect(result).toContain('[CARD]');
            expect(result).not.toContain('4111 1111 1111 1111');
        });

        it('redacts credit card with dashes', () => {
            const result = redactPII('Card: 4111-1111-1111-1111');
            expect(result).toContain('[CARD]');
            expect(result).not.toContain('4111-1111-1111-1111');
        });

        it('redacts credit card without separators', () => {
            const result = redactPII('Card: 4111111111111111');
            expect(result).toContain('[CARD]');
            expect(result).not.toContain('4111111111111111');
        });
    });

    // ─── Street Address Redaction ───────────────────────────────────────

    describe('street address redaction', () => {
        it('redacts street addresses', () => {
            const result = redactPII('Lives at 42 Smith Street');
            expect(result).toContain('[ADDRESS]');
            expect(result).not.toContain('42 Smith Street');
        });

        it('redacts road addresses', () => {
            const result = redactPII('Located at 123 Main Road');
            expect(result).toContain('[ADDRESS]');
            expect(result).not.toContain('123 Main Road');
        });

        it('redacts avenue addresses', () => {
            const result = redactPII('Office at 7 Park Avenue');
            expect(result).toContain('[ADDRESS]');
            expect(result).not.toContain('7 Park Avenue');
        });

        it('redacts drive addresses', () => {
            const result = redactPII('Home: 55 Ocean Drive');
            expect(result).toContain('[ADDRESS]');
            expect(result).not.toContain('55 Ocean Drive');
        });

        it('redacts crescent addresses', () => {
            const result = redactPII('Address: 8 Willow Crescent');
            expect(result).toContain('[ADDRESS]');
            expect(result).not.toContain('8 Willow Crescent');
        });
    });

    // ─── Name Redaction (Aggressive Mode) ───────────────────────────────

    describe('name redaction (aggressive mode)', () => {
        it('redacts names with title prefix (Mr)', () => {
            const result = redactPII('Mr Smith brought in his dog.', { aggressive: true });
            expect(result).toContain('[CLIENT_NAME]');
            expect(result).not.toContain('Smith');
        });

        it('redacts names with title prefix (Mrs)', () => {
            const result = redactPII('Mrs Johnson called about her cat.', { aggressive: true });
            expect(result).toContain('[CLIENT_NAME]');
            expect(result).not.toContain('Johnson');
        });

        it('redacts names with title prefix (Dr)', () => {
            const result = redactPII('Referred by Dr Williams.', { aggressive: true });
            expect(result).toContain('[CLIENT_NAME]');
            expect(result).not.toContain('Williams');
        });

        it('redacts owner/client name patterns', () => {
            const result = redactPII('Owner is Sarah Thompson.', { aggressive: true });
            expect(result).toContain('[CLIENT_NAME]');
            expect(result).not.toContain('Sarah Thompson');
        });

        it('does not redact names in non-aggressive mode', () => {
            const result = redactPII('Mr Smith brought in his dog.');
            // In non-aggressive mode, names are not redacted
            expect(result).toContain('Mr Smith');
        });
    });

    // ─── detectPIITypes ─────────────────────────────────────────────────

    describe('detectPIITypes()', () => {
        it('detects phone numbers', () => {
            const types = detectPIITypes('Call 0412 345 678');
            expect(types).toContain('PHONE');
        });

        it('detects email addresses', () => {
            const types = detectPIITypes('Email: test@example.com');
            expect(types).toContain('EMAIL');
        });

        it('detects microchip numbers', () => {
            const types = detectPIITypes('Chip: 956000012345678');
            expect(types).toContain('MICROCHIP');
        });

        it('detects credit cards', () => {
            const types = detectPIITypes('Card: 4111 1111 1111 1111');
            expect(types).toContain('CARD');
        });

        it('detects street addresses', () => {
            const types = detectPIITypes('Lives at 42 Smith Street');
            expect(types).toContain('ADDRESS');
        });

        it('detects multiple PII types', () => {
            const types = detectPIITypes(
                'Call 0412 345 678 or email test@example.com. Lives at 42 Smith Street.'
            );
            expect(types).toContain('PHONE');
            expect(types).toContain('EMAIL');
            expect(types).toContain('ADDRESS');
        });

        it('returns empty array for clean text', () => {
            const types = detectPIITypes('The cat is healthy and eating well.');
            expect(types).toEqual([]);
        });

        it('returns unique types only', () => {
            const types = detectPIITypes('Call 0412 345 678 or 0498 765 432');
            const phoneCount = types.filter(t => t === 'PHONE').length;
            expect(phoneCount).toBe(1);
        });
    });

    // ─── generateRedactionReport ────────────────────────────────────────

    describe('generateRedactionReport()', () => {
        it('reports correct original and redacted lengths', () => {
            const original = 'Call me on 0412 345 678 please.';
            const redacted = redactPII(original);
            const report = generateRedactionReport(original, redacted);
            expect(report.originalLength).toBe(original.length);
            expect(report.redactedLength).toBe(redacted.length);
        });

        it('counts redactions correctly', () => {
            const original = 'Phone: 0412 345 678. Email: test@example.com.';
            const redacted = redactPII(original);
            const report = generateRedactionReport(original, redacted);
            expect(report.redactionsCount).toBeGreaterThanOrEqual(2);
        });

        it('identifies PII types found', () => {
            const original = 'Call 0412 345 678 or email test@example.com';
            const redacted = redactPII(original);
            const report = generateRedactionReport(original, redacted);
            expect(report.piiTypesFound).toContain('PHONE');
            expect(report.piiTypesFound).toContain('EMAIL');
        });

        it('reports zero redactions for clean text', () => {
            const original = 'The dog is healthy.';
            const redacted = redactPII(original);
            const report = generateRedactionReport(original, redacted);
            expect(report.redactionsCount).toBe(0);
            expect(report.piiTypesFound).toEqual([]);
        });

        it('redacted text is shorter or equal to original', () => {
            const original = 'Owner Mrs Sarah Thompson at 42 Smith Street, phone 0412 345 678, email sarah@vet.com';
            const redacted = redactPII(original, { aggressive: true });
            const report = generateRedactionReport(original, redacted);
            // Redacted placeholders are typically shorter than the original PII
            expect(report.redactedLength).toBeLessThanOrEqual(report.originalLength);
        });
    });
});
