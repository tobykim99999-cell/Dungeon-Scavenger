import { describe, expect, it } from 'vitest';
import { getRegion, getRegionIndex, parseRegionProgress, unlockRegion } from '../src/game/regions';

describe('ten-floor region progression', () => {
  it('groups floors into ten-floor regions', () => {
    expect(getRegionIndex(1)).toBe(0);
    expect(getRegionIndex(10)).toBe(0);
    expect(getRegionIndex(11)).toBe(1);
    expect(getRegionIndex(20)).toBe(1);
    expect(getRegionIndex(21)).toBe(2);
  });

  it('starts each selected region at its first floor', () => {
    expect(getRegion(0)).toMatchObject({ startFloor: 1, endFloor: 10 });
    expect(getRegion(1)).toMatchObject({ startFloor: 11, endFloor: 20 });
    expect(getRegion(2)).toMatchObject({ startFloor: 21, endFloor: 30 });
  });

  it('unlocks the region where an escape scroll is used', () => {
    expect(unlockRegion(0, 7)).toBe(0);
    expect(unlockRegion(0, 14)).toBe(1);
    expect(unlockRegion(1, 28)).toBe(2);
  });

  it('does not unlock the next region before entering it', () => {
    expect(unlockRegion(0, 10)).toBe(0);
    expect(unlockRegion(0, 20)).toBe(1);
    expect(unlockRegion(1, 30)).toBe(2);
  });

  it('keeps malformed saved progress on the first region', () => {
    expect(parseRegionProgress(null)).toBe(0);
    expect(parseRegionProgress('invalid')).toBe(0);
    expect(parseRegionProgress('-4')).toBe(0);
    expect(parseRegionProgress('3')).toBe(3);
  });
});
