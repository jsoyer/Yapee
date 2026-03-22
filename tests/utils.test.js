import { describe, it, expect } from 'vitest';
import { nameFromUrl, formatBytes, parseEtaSeconds, formatEta } from '../js/utils.js';

describe('nameFromUrl', () => {
  it('extracts filename without extension', () => {
    expect(nameFromUrl('https://example.com/path/file.zip')).toBe('file');
  });
  it('handles URL with no path segments', () => {
    expect(nameFromUrl('https://example.com/')).toBe('https://example.com/');
  });
  it('keeps short filenames (stem <= 2 chars) as raw last segment', () => {
    // stem 'ab' is 2 chars so name.length > 2 is false — falls through to url.split('/').pop()
    expect(nameFromUrl('https://example.com/ab.zip')).toBe('ab.zip');
  });
  it('decodes URL-encoded names', () => {
    expect(nameFromUrl('https://example.com/my%20file.zip')).toBe('my file');
  });
  it('handles invalid URLs', () => {
    expect(nameFromUrl('not a url')).toBe('not a url');
  });
});

describe('formatBytes', () => {
  it('returns empty string for null', () => {
    expect(formatBytes(null)).toBe('');
  });
  it('formats sub-KB values in KB (rounds via toFixed(0))', () => {
    // 500 / 1000 = 0.5, toFixed(0) rounds to 1
    expect(formatBytes(500)).toBe('1 KB');
  });
  it('formats KB', () => {
    expect(formatBytes(2000)).toBe('2 KB');
  });
  it('formats MB', () => {
    expect(formatBytes(1e6)).toBe('1 MB');
  });
  it('formats GB', () => {
    expect(formatBytes(1e9)).toBe('1.0 GB');
  });
  it('formats fractional GB', () => {
    expect(formatBytes(1.5e9)).toBe('1.5 GB');
  });
});

describe('parseEtaSeconds', () => {
  it('parses HH:MM:SS format', () => {
    expect(parseEtaSeconds('01:30:00')).toBe(5400);
  });
  it('parses HH:MM:SS with seconds', () => {
    expect(parseEtaSeconds('00:05:30')).toBe(330);
  });
  it('returns 0 for all-zero timestamp', () => {
    expect(parseEtaSeconds('00:00:00')).toBe(0);
  });
  it('returns 0 for empty string', () => {
    expect(parseEtaSeconds('')).toBe(0);
  });
  it('returns 0 for null', () => {
    expect(parseEtaSeconds(null)).toBe(0);
  });
  it('returns 0 for undefined', () => {
    expect(parseEtaSeconds(undefined)).toBe(0);
  });
  it('returns 0 for MM:SS (not 3 parts)', () => {
    expect(parseEtaSeconds('05:30')).toBe(0);
  });
});

describe('formatEta', () => {
  // formatEta calls msgFn('popupQueueEta', [label]) — we pass a stub that returns the label directly
  const msgFn = (_key, args) => args[0];

  it('formats hours and minutes', () => {
    expect(formatEta(3661, msgFn)).toBe('1h01');
  });
  it('formats minutes only', () => {
    expect(formatEta(300, msgFn)).toBe('5min');
  });
  it('formats sub-minute as <1min', () => {
    expect(formatEta(45, msgFn)).toBe('<1min');
  });
  it('returns empty string for 0', () => {
    expect(formatEta(0, msgFn)).toBe('');
  });
  it('returns empty string for negative', () => {
    expect(formatEta(-10, msgFn)).toBe('');
  });
});
