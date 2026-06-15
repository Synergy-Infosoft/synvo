import { describe, expect, it } from 'vitest';
import { metaMediaNeedsRefresh } from './media-assets';

describe('metaMediaNeedsRefresh', () => {
  const now = new Date('2026-06-15T00:00:00Z').getTime();

  it('keeps recent uploads', () => {
    expect(metaMediaNeedsRefresh('2026-06-14T00:00:00Z', now)).toBe(false);
  });

  it('refreshes old or malformed timestamps', () => {
    expect(metaMediaNeedsRefresh('2026-05-01T00:00:00Z', now)).toBe(true);
    expect(metaMediaNeedsRefresh('not-a-date', now)).toBe(true);
  });
});
