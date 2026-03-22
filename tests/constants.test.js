import { describe, it, expect } from 'vitest';
import * as constants from '../js/constants.js';

describe('constants', () => {
  it('API_TIMEOUT is a positive number', () => {
    expect(constants.API_TIMEOUT).toBeGreaterThan(0);
  });
  it('MAX_RETRY_ATTEMPTS is reasonable', () => {
    expect(constants.MAX_RETRY_ATTEMPTS).toBeGreaterThan(0);
    expect(constants.MAX_RETRY_ATTEMPTS).toBeLessThan(100);
  });
  it('HISTORY_MAX is a positive integer', () => {
    expect(constants.HISTORY_MAX).toBeGreaterThan(0);
    expect(Number.isInteger(constants.HISTORY_MAX)).toBe(true);
  });
  it('ALARM_PERIOD_MINUTES is positive', () => {
    expect(constants.ALARM_PERIOD_MINUTES).toBeGreaterThan(0);
  });
  it('retry backoff values are consistent', () => {
    expect(constants.MAX_RETRY_BACKOFF).toBeGreaterThan(constants.INITIAL_RETRY_BACKOFF);
  });
});
