import { describe, expect, it } from 'vitest';
import {
  collectWalkableTiles,
  generateBossArena,
  generateDungeon,
  hasPath,
  MAP_HEIGHT,
  MAP_WIDTH,
} from '../src/game/dungeon';
import { computeFieldOfView } from '../src/game/fov';

describe('dungeon generation', () => {
  it('always connects the entrance to the exit for representative seeds', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const dungeon = generateDungeon(seed);
      expect(hasPath(dungeon.tiles, dungeon.start, dungeon.exit), `seed ${seed}`).toBe(true);
      expect(dungeon.rooms.length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps all walkable tiles inside the playable bounds', () => {
    const dungeon = generateDungeon(94721);
    for (const tile of collectWalkableTiles(dungeon)) {
      expect(tile.x).toBeGreaterThan(0);
      expect(tile.x).toBeLessThan(MAP_WIDTH - 1);
      expect(tile.y).toBeGreaterThan(0);
      expect(tile.y).toBeLessThan(MAP_HEIGHT - 1);
    }
  });

  it('repeats a map when given the same seed', () => {
    expect(generateDungeon(104729)).toEqual(generateDungeon(104729));
  });

  it('builds the boss stage as one large connected arena', () => {
    const arena = generateBossArena(10);

    expect(arena.rooms).toHaveLength(1);
    expect(collectWalkableTiles(arena)).toHaveLength((MAP_WIDTH - 4) * (MAP_HEIGHT - 4));
    expect(hasPath(arena.tiles, arena.start, arena.exit)).toBe(true);
  });
});

describe('field of view', () => {
  it('reveals a blocking wall but not the tile behind it', () => {
    const tiles = [
      [1, 1, 1, 1, 1],
      [1, 1, 0, 1, 1],
      [1, 1, 1, 1, 1],
    ] as const;
    const visible = computeFieldOfView(tiles.map((row) => [...row]), { x: 1, y: 1 }, 5);

    expect(visible.has('2,1')).toBe(true);
    expect(visible.has('3,1')).toBe(false);
  });
});
