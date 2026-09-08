import { findPath, type Point, type Tile } from './dungeon';
import { getRegionIndex } from './regions';

export const SECOND_BOSS_TRIAL_TURNS = 45;
export const SECOND_BOSS_STORM_COUNT = 12;
export interface SecondBossTrial {
  phase: 'trial' | 'storm';
  turns: number;
  justTriggered: boolean;
}

export function shouldStartSecondBossTrial(floor: number, isBoss: boolean, hp: number, damage: number): boolean {
  return isBoss && getRegionIndex(floor) === 1 && hp > 0 && damage >= hp;
}

export function advanceSecondBossTrial(state: SecondBossTrial, guardians: number): 'waiting' | 'success' | 'failed' | 'storm' {
  if (state.justTriggered) {
    state.justTriggered = false;
    return 'waiting';
  }
  state.turns += 1;
  if (state.phase === 'storm') return 'storm';
  if (guardians === 0 && state.turns <= SECOND_BOSS_TRIAL_TURNS) return 'success';
  if (state.turns >= SECOND_BOSS_TRIAL_TURNS) {
    state.phase = 'storm';
    return 'failed';
  }
  return 'waiting';
}

export function getSecondBossTrialCorners(boss: Point, tiles: Tile[][], blocked: ReadonlySet<string>): Point[] {
  let best: Point[] = [];
  let bestDistance = Infinity;
  for (let y = 0; y + 10 < tiles.length; y += 1) {
    for (let x = 0; x + 10 < tiles[y].length; x += 1) {
      const distance = (x + 5 - boss.x) ** 2 + (y + 5 - boss.y) ** 2;
      if (distance >= bestDistance) continue;
      const corners = [{ x, y }, { x: x + 10, y }, { x: x + 10, y: y + 10 }, { x, y: y + 10 }];
      if (corners.some((point) => blocked.has(`${point.x},${point.y}`))) continue;
      let walkable = true;
      for (let row = y; row <= y + 10 && walkable; row += 1) {
        for (let column = x; column <= x + 10; column += 1) {
          if (tiles[row]?.[column] !== 1) { walkable = false; break; }
        }
      }
      if (walkable) { best = corners; bestDistance = distance; }
    }
  }
  return best;
}

export function getSecondBossGuardianStats(hp: number, attack: number, defense: number) {
  return { hp: Math.max(1, Math.round(hp * 0.1)), attack: Math.max(1, Math.round(attack * 0.4)), defense: Math.max(0, Math.round(defense * 0.5)) };
}

export function getSecondBossStormSpawns(tiles: Tile[][]): Point[] {
  const perimeter: Point[] = [];
  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < tiles[y].length; x += 1) {
      if (tiles[y][x] === 1 && (tiles[y - 1]?.[x] !== 1 || tiles[y + 1]?.[x] !== 1 || tiles[y][x - 1] !== 1 || tiles[y][x + 1] !== 1)) perimeter.push({ x, y });
    }
  }
  const count = Math.min(SECOND_BOSS_STORM_COUNT, perimeter.length);
  return Array.from({ length: count }, (_, index) => perimeter[Math.floor(index * perimeter.length / count)]);
}

export function getStormStep(tiles: Tile[][], from: Point, player: Point): Point {
  const path = findPath(tiles, from, player);
  return path[Math.min(1, path.length - 1)] ?? from;
}
