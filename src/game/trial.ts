import { MAP_HEIGHT, MAP_WIDTH, isWalkable, type Dungeon, type Point, type Tile } from './dungeon';
import type { BossStats } from './progression';

export const TRIAL_BOSS_NAME = '断誓铁卫';
export const TRIAL_CENTER: Readonly<Point> = { x: 14, y: 9 };
export const TRIAL_PILLARS: readonly Readonly<Point>[] = [
  { x: 10, y: 9 }, { x: 18, y: 9 }, { x: 14, y: 5 }, { x: 14, y: 13 },
];

export interface TrialPlayerProfile {
  attack: number;
  defense: number;
  maxHp: number;
  crit: number;
  bleed: number;
}

export interface TrialSnapshot {
  player: TrialPlayerProfile;
  boss: BossStats;
}

export interface TrialCharge {
  origin: Point;
  tiles: Point[];
  pillar?: Point;
}

export interface TrialWarden {
  phase: 'hunt' | 'charge' | 'echo' | 'stagger' | 'recovery';
  turns: number;
  huntActions: number;
  secondPhase: boolean;
  charge?: TrialCharge;
}

export function createTrialSnapshot(profile: TrialPlayerProfile): TrialSnapshot {
  const player = { ...profile };
  const attack = Math.max(1, player.attack);
  const defense = Math.max(0, player.defense);
  const maxHp = Math.max(1, player.maxHp);
  const output = attack * (1 + Math.min(100, Math.max(0, player.crit)) / 100) + Math.max(0, player.bleed) * 0.6;
  return {
    player,
    boss: {
      hp: Math.max(20, Math.round(56 * (output / 4) ** 0.85)),
      // Defense contributes less than its mitigation, so armor upgrades still improve survival.
      attack: Math.max(3, Math.round(3.2 * (maxHp / 24) ** 0.8 + 0.18 * defense ** 0.85)),
      defense: Math.min(Math.floor(attack * 0.3), Math.round(1.5 * (output / 4) ** 0.55)),
      reward: 100,
    },
  };
}

export function generateTrialArena(seed: number): Dungeon {
  const tiles: Tile[][] = Array.from({ length: MAP_HEIGHT }, () => Array<Tile>(MAP_WIDTH).fill(0));
  const room = { x: 8, y: 3, width: 13, height: 13, center: { ...TRIAL_CENTER } };
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) tiles[y][x] = 1;
  }
  for (const pillar of TRIAL_PILLARS) tiles[pillar.y][pillar.x] = 0;
  return { tiles, rooms: [room], start: { x: 14, y: 12 }, exit: { ...TRIAL_CENTER }, seed };
}

export function planTrialCharge(tiles: Tile[][], boss: Point, player: Point): TrialCharge | undefined {
  if ((boss.x !== player.x && boss.y !== player.y) || (boss.x === player.x && boss.y === player.y)) return;
  const direction = { x: Math.sign(player.x - boss.x), y: Math.sign(player.y - boss.y) };
  const path: Point[] = [];
  let cursor = { x: boss.x + direction.x, y: boss.y + direction.y };
  while (isWalkable(tiles, cursor)) {
    path.push(cursor);
    cursor = { x: cursor.x + direction.x, y: cursor.y + direction.y };
  }
  if (!path.some((point) => point.x === player.x && point.y === player.y)) return;
  const pillar = TRIAL_PILLARS.find((point) => point.x === cursor.x && point.y === cursor.y);
  return { origin: { ...boss }, tiles: path, pillar: pillar ? { ...pillar } : undefined };
}

export function getTrialChargeLanding(charge: TrialCharge, player: Point): Point {
  // A hit does not push or overlap the player when they occupy the last tile before a pillar.
  const landing = [...charge.tiles].reverse().find((point) => point.x !== player.x || point.y !== player.y);
  return { ...(landing ?? charge.origin) };
}

export function createTrialWarden(): TrialWarden {
  return { phase: 'hunt', turns: 0, huntActions: 0, secondPhase: false };
}

export function startTrialCharge(state: TrialWarden, charge: TrialCharge): void {
  state.phase = 'charge';
  state.turns = 2;
  state.huntActions = 0;
  state.charge = charge;
}

function startTrialRecovery(state: TrialWarden): void {
  state.phase = state.charge?.pillar ? 'stagger' : 'recovery';
  state.turns = state.charge?.pillar ? 2 : 1;
}

export function advanceTrialWarden(state: TrialWarden): 'hunt' | 'charging' | 'impact' | 'echo' | 'recovering' | 'recovered' {
  if (state.phase === 'hunt') return 'hunt';
  state.turns = Math.max(0, state.turns - 1);
  if (state.phase === 'charge') {
    if (state.turns > 0) return 'charging';
    if (state.secondPhase) {
      state.phase = 'echo';
      state.turns = 1;
    } else startTrialRecovery(state);
    return 'impact';
  }
  if (state.phase === 'echo') {
    startTrialRecovery(state);
    return 'echo';
  }
  if (state.turns > 0) return 'recovering';
  state.phase = 'hunt';
  state.huntActions = 0;
  state.charge = undefined;
  return 'recovered';
}

export function getTrialWardenDefense(baseDefense: number, state: TrialWarden): number {
  return state.phase === 'stagger' ? Math.floor(baseDefense * 0.5) : baseDefense;
}

export function getTrialReceivedDamage(damage: number, state: TrialWarden): number {
  if (damage <= 0) return 0;
  return Math.max(1, state.phase === 'stagger' ? damage : Math.floor(damage * 0.75));
}

export function getTrialSkillDamage(attack: number, defense: number, kind: 'charge' | 'echo'): number {
  const multiplier = kind === 'charge' ? 2.3 : 1.1;
  const mitigation = kind === 'charge' ? 0.4 : 0.25;
  return Math.max(2, Math.round(attack * multiplier) - Math.floor(Math.max(0, defense) * mitigation));
}

export function getTrialWardenStatus(state: TrialWarden): string {
  if (state.phase === 'charge') return `断誓冲锋 · ${state.turns} 回合后释放`;
  if (state.phase === 'echo') return '裂地回响 · 1 回合后爆发';
  if (state.phase === 'stagger') return `破甲失衡 · 防御减半 · ${state.turns} 回合`;
  if (state.phase === 'recovery') return `撞墙停顿 · ${state.turns} 回合`;
  return '重甲 · 减伤 25%';
}
