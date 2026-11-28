import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { cleanClinicalImportUrl, readClinicalImportParams } from './importParams';

describe('clinical import URL params (Red Team L7)', () => {
  it('reads source, package, and returnUrl from URL hash fragment', () => {
    const res = readClinicalImportParams('', '#source=imaging&package=abc123&returnUrl=ret456');
    expect(res).toEqual({
      source: 'imaging',
      encodedPackage: 'abc123',
      returnUrl: 'ret456',
    });
  });

  it('prefers hash fragment over query string when both are present', () => {
    const res = readClinicalImportParams(
      '?source=imaging&package=fromQuery',
      '#source=imaging&package=fromHash'
    );
    expect(res.encodedPackage).toBe('fromHash');
  });

  it('falls back to query string for backward compatibility with older links', () => {
    const res = readClinicalImportParams('?source=imaging&package=legacyPkg', '');
    expect(res).toEqual({
      source: 'imaging',
      encodedPackage: 'legacyPkg',
      returnUrl: null,
    });
  });

  it('strips clinical import params from both hash fragment and query string while preserving unrelated params', () => {
    expect(
      cleanClinicalImportUrl('https://vetnotes.me/notes?utm_source=test#source=imaging&package=secret&returnUrl=r1')
    ).toBe('/notes?utm_source=test');

    expect(
      cleanClinicalImportUrl('https://vetnotes.me/?source=imaging&package=secret&returnUrl=r1')
    ).toBe('/');

    expect(
      cleanClinicalImportUrl('https://vetnotes.me/?source=imaging&package=secret#editor')
    ).toBe('/#editor');
  });

  it('VetNotesEditor uses readClinicalImportParams and cleanClinicalImportUrl', () => {
    const editorSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/VetNotesEditor.svelte'),
      'utf8'
    );
    expect(editorSrc).toContain('readClinicalImportParams');
    expect(editorSrc).toContain('cleanClinicalImportUrl');
  });
});
