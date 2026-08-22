import { describe, it, expect } from 'vitest';
import { parseOverrides, validateOverrides, serializeOverrides } from '../translations-api/store.js';

describe('validateOverrides', () => {
  it('accepts an object of locale maps of strings', () => {
    expect(validateOverrides({ en: { A: 'a' }, pt: {} })).toBe(true);
  });
  it('accepts an empty object', () => {
    expect(validateOverrides({})).toBe(true);
  });
  it('rejects arrays', () => {
    expect(validateOverrides([])).toBe(false);
  });
  it('rejects null', () => {
    expect(validateOverrides(null)).toBe(false);
  });
  it('rejects non-string leaf values', () => {
    expect(validateOverrides({ en: { A: 5 } })).toBe(false);
  });
  it('rejects non-object locale values', () => {
    expect(validateOverrides({ en: 'nope' })).toBe(false);
  });
});

describe('parseOverrides', () => {
  it('parses valid JSON', () => {
    expect(parseOverrides('{"en":{"A":"a"}}')).toEqual({ en: { A: 'a' } });
  });
  it('returns {} for malformed JSON', () => {
    expect(parseOverrides('{not json')).toEqual({});
  });
  it('returns {} for valid JSON of the wrong shape', () => {
    expect(parseOverrides('[1,2,3]')).toEqual({});
  });
});

describe('serializeOverrides', () => {
  it('pretty-prints with 2-space indent', () => {
    expect(serializeOverrides({ en: { A: 'a' } })).toBe('{\n  "en": {\n    "A": "a"\n  }\n}');
  });
});
