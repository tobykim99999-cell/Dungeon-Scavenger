import { describe, expect, it } from 'vitest';
import { collectWalkableTiles, findPath, hasPath, type Point } from '../src/game/dungeon';
import { getAdventureDifficultyFloor, shouldUnlockHeroic } from '../src/game/heroic';
import {
  TRIAL_CENTER, TRIAL_PILLARS, advanceTrialWarden, createTrialSnapshot, createTrialWarden,
  generateTrialArena, getTrialChargeLanding, getTrialReceivedDamage, getTrialSkillDamage,
  getTrialWardenDefense, getTrialWardenStatus, planTrialCharge, startTrialCharge,
} from '../src/game/trial';

const starter = { attack: 4, defense: 1, maxHp: 24, crit: 0, bleed: 0 };
const arena = generateTrialArena(123);
const charge = planTrialCharge(arena.tiles, TRIAL_CENTER, arena.start)!;

describe('adaptive trial difficulty', () => {
  it('creates a detached entry snapshot and separates offense from survival', () => {
    const profile = { ...starter };
    const snapshot = createTrialSnapshot(profile);
    profile.attack = 999;
    expect(snapshot.player.attack).toBe(4);
    expect(snapshot.boss).toEqual({ hp: 56, attack: 3, defense: 1, reward: 100 });
    const offense = createTrialSnapshot({ ...starter, attack: 30 }).boss;
    const survival = createTrialSnapshot({ ...starter, maxHp: 70, defense: 25 }).boss;
    expect(offense.hp).toBeGreaterThan(snapshot.boss.hp);
    expect(offense.attack).toBe(snapshot.boss.attack);
    expect(survival.attack).toBeGreaterThan(snapshot.boss.attack);
    expect(survival.hp).toBe(snapshot.boss.hp);
  });

  it.each(['crit', 'bleed'] as const)('includes active %s effects in the offense estimate', (stat) => {
    expect(createTrialSnapshot({ ...starter, [stat]: 20 }).boss.hp).toBeGreaterThan(createTrialSnapshot(starter).boss.hp);
  });

  it('scales below player growth while preserving damage against boss armor', () => {
    const profile = { attack: 30, defense: 15, maxHp: 60, crit: 0, bleed: 0 };
    const first = createTrialSnapshot(profile).boss;
    const doubled = createTrialSnapshot({ ...profile, attack: 60, defense: 30, maxHp: 120 }).boss;
    expect(doubled.hp).toBeGreaterThan(first.hp);
    expect(doubled.hp).toBeLessThan(first.hp * 2);
    expect(doubled.attack).toBeGreaterThan(first.attack);
    expect(doubled.attack).toBeLessThan(first.attack * 2);
    for (const attack of [1, 4, 10, 30, 60, 150]) {
      expect(createTrialSnapshot({ ...starter, attack }).boss.defense).toBeLessThanOrEqual(attack * 0.3);
    }
  });

  it('does not cancel defensive upgrades with equal attack increases', () => {
    const low = { ...starter, maxHp: 60, defense: 5 };
    const high = { ...low, defense: 25 };
    for (const kind of ['charge', 'echo'] as const) {
      expect(getTrialSkillDamage(createTrialSnapshot(high).boss.attack, high.defense, kind))
        .toBeLessThan(getTrialSkillDamage(createTrialSnapshot(low).boss.attack, low.defense, kind));
    }
  });

  it('does not reuse heroic scaling or unlock heroic regions', () => {
    expect(getAdventureDifficultyFloor('trial', 1)).toBe(1);
    expect(shouldUnlockHeroic('trial', 50)).toBe(false);
  });
});

describe('trial arena and fixed charge route', () => {
  it('provides a connected 13 by 13 room with four solid pillars', () => {
    expect(arena.rooms[0]).toMatchObject({ width: 13, height: 13 });
    expect(collectWalkableTiles(arena)).toHaveLength(13 * 13 - 4);
    for (const point of TRIAL_PILLARS) expect(arena.tiles[point.y][point.x]).toBe(0);
    for (const point of collectWalkableTiles(arena)) expect(hasPath(arena.tiles, arena.start, point)).toBe(true);
    const path = findPath(arena.tiles, { x: 13, y: 13 }, { x: 15, y: 13 });
    expect(path).not.toContainEqual({ x: 14, y: 13 });
  });

  it('locks the route through the target and stops at a pillar', () => {
    expect(charge.tiles).toEqual([{ x: 14, y: 10 }, { x: 14, y: 11 }, { x: 14, y: 12 }]);
    expect(charge.pillar).toEqual({ x: 14, y: 13 });
    expect(charge.origin).toEqual(TRIAL_CENTER);
    const movedPlayer = { x: 15, y: 12 };
    expect(getTrialChargeLanding(charge, movedPlayer)).toEqual({ x: 14, y: 12 });
    expect(charge.tiles).not.toContainEqual(movedPlayer);
  });

  it('rejects diagonal targets, overlapping positions, and targets behind a pillar', () => {
    for (const target of [{ x: 15, y: 12 }, TRIAL_CENTER, { x: 14, y: 14 }]) {
      expect(planTrialCharge(arena.tiles, TRIAL_CENTER, target)).toBeUndefined();
    }
  });

  it('distinguishes a normal wall collision from hitting a pillar', () => {
    const wall = planTrialCharge(arena.tiles, { x: 12, y: 9 }, { x: 12, y: 11 })!;
    expect(wall.pillar).toBeUndefined();
    expect(wall.tiles.at(-1)).toEqual({ x: 12, y: 15 });
  });

  it('never lands on the player even when they stand in the final available tile', () => {
    expect(getTrialChargeLanding(charge, arena.start)).toEqual({ x: 14, y: 11 });
    const adjacent = planTrialCharge(arena.tiles, { x: 14, y: 11 }, arena.start)!;
    expect(getTrialChargeLanding(adjacent, arena.start)).toEqual({ x: 14, y: 11 });
  });

  it('always leaves a reachable one-action sidestep out of a telegraphed charge', () => {
    const walkable = collectWalkableTiles(arena);
    const offsets: Point[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    for (const boss of walkable) for (const player of walkable) {
      const plan = planTrialCharge(arena.tiles, boss, player);
      if (!plan) continue;
      const safe = offsets.some((offset) => {
        const point = { x: player.x + offset.x, y: player.y + offset.y };
        return arena.tiles[point.y]?.[point.x] === 1 &&
          (point.x !== boss.x || point.y !== boss.y) &&
          !plan.tiles.some((tile) => tile.x === point.x && tile.y === point.y);
      });
      expect(safe).toBe(true);
    }
  });
});

describe('trial warden phases', () => {
  it('gives two full actions to dodge and two full actions to exploit a pillar collision', () => {
    const state = createTrialWarden();
    startTrialCharge(state, charge);
    expect(state.turns).toBe(2);
    expect(getTrialWardenStatus(state)).toContain('2 回合');
    expect(advanceTrialWarden(state)).toBe('charging');
    expect(state.phase).toBe('charge');
    expect(state.turns).toBe(1);
    expect(advanceTrialWarden(state)).toBe('impact');
    expect(state).toMatchObject({ phase: 'stagger', turns: 2 });
    expect(advanceTrialWarden(state)).toBe('recovering');
    expect(state.turns).toBe(1);
    expect(advanceTrialWarden(state)).toBe('recovered');
    expect(state).toMatchObject({ phase: 'hunt', turns: 0, huntActions: 0 });
    expect(state.charge).toBeUndefined();
  });

  it('resolves the half-health echo before opening the full stagger window', () => {
    const state = createTrialWarden();
    startTrialCharge(state, charge);
    advanceTrialWarden(state);
    state.secondPhase = true;
    expect(advanceTrialWarden(state)).toBe('impact');
    expect(state).toMatchObject({ phase: 'echo', turns: 1 });
    expect(getTrialWardenDefense(9, state)).toBe(9);
    expect(getTrialReceivedDamage(20, state)).toBe(15);
    expect(advanceTrialWarden(state)).toBe('echo');
    expect(state).toMatchObject({ phase: 'stagger', turns: 2 });
    expect(getTrialWardenDefense(9, state)).toBe(4);
    expect(getTrialReceivedDamage(20, state)).toBe(20);
    expect(advanceTrialWarden(state)).toBe('recovering');
    expect(advanceTrialWarden(state)).toBe('recovered');
    expect(state.secondPhase).toBe(true);
  });

  it('only grants a one-turn non-armored-break pause for a normal wall collision', () => {
    const state = createTrialWarden();
    startTrialCharge(state, planTrialCharge(arena.tiles, { x: 12, y: 9 }, { x: 12, y: 11 })!);
    advanceTrialWarden(state); advanceTrialWarden(state);
    expect(state).toMatchObject({ phase: 'recovery', turns: 1 });
    expect(getTrialWardenDefense(10, state)).toBe(10);
    expect(getTrialReceivedDamage(20, state)).toBe(15);
    expect(advanceTrialWarden(state)).toBe('recovered');
  });

  it('keeps minimum damage and treats zero incoming damage as zero', () => {
    const state = createTrialWarden();
    expect(getTrialReceivedDamage(0, state)).toBe(0);
    expect(getTrialReceivedDamage(1, state)).toBe(1);
    expect(getTrialSkillDamage(3, 999, 'charge')).toBe(2);
    expect(getTrialSkillDamage(3, 999, 'echo')).toBe(2);
    expect(getTrialSkillDamage(3, 1, 'charge')).toBe(7);
    expect(getTrialSkillDamage(3, 1, 'echo')).toBe(3);
  });
});
