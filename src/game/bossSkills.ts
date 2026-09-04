import { getRegionIndex } from './regions';
import type { Point, Tile } from './dungeon';

export type BossSkillId = 'rockfall' | 'thunder' | 'spore-rain' | 'meteor' | 'void-rift' | 'annihilation-cross';
export type BossSkillVisual = 'quake' | 'lightning' | 'poison' | 'fire' | 'void' | 'nova';

export interface BossSkillDefinition {
  id: BossSkillId;
  name: string;
  description: string;
  dangerDescription: string;
  visual: BossSkillVisual;
  color: number;
  damageMultiplier: number;
  defenseMultiplier: number;
  chargeTurns: number;
}

export interface BossChargeReinforcement {
  shield: number;
  summonCount: number;
}

export interface ShieldDamageResult {
  absorbed: number;
  healthDamage: number;
  remainingShield: number;
}

export const FOURTH_BOSS_CONTROL_TURNS = 2;
export const FOURTH_BOSS_BURN_TURNS = 3;
export const FOURTH_BOSS_HEAL_TURNS = 3;
export const FIFTH_BOSS_SUMMON_CAP = 4;
export const THIRD_BOSS_SUMMON_CAP = 5;
const THIRD_BOSS_REGION_INDEX = 2;
const FOURTH_BOSS_REGION_INDEX = 3;
const FIFTH_BOSS_REGION_INDEX = 4;
const FIFTH_BOSS_SHIELD_RATIO = 0.15;
const FIFTH_BOSS_SUMMON_COUNT = 2;

const BOSS_SKILLS: readonly BossSkillDefinition[] = [
  {
    id: 'rockfall',
    name: '崩岩横断',
    description: '震裂目标所在横排，蓄力一回合后落石轰击。',
    dangerDescription: '横向 5 格',
    visual: 'quake',
    color: 0xd6a05f,
    damageMultiplier: 1.05,
    defenseMultiplier: 0.5,
    chargeTurns: 1,
  },
  {
    id: 'thunder',
    name: '潮鸣天雷',
    description: '锁定目标所在纵列，引导贯穿水雷。',
    dangerDescription: '纵向 5 格',
    visual: 'lightning',
    color: 0x7edcf2,
    damageMultiplier: 1.15,
    defenseMultiplier: 0.25,
    chargeTurns: 1,
  },
  {
    id: 'spore-rain',
    name: '孢子蚀雨',
    description: '在目标与四个斜角播下腐蚀孢子，释放时孵化蚀孢幼体。',
    dangerDescription: '目标格与四个斜角',
    visual: 'poison',
    color: 0x9edb63,
    damageMultiplier: 0.9,
    defenseMultiplier: 0.35,
    chargeTurns: 1,
  },
  {
    id: 'meteor',
    name: '陨火天坠',
    description: '召来五片密集的不规则火雨，命中后造成禁锢与持续灼烧。每损失三分之一生命会进入无敌再生。',
    dangerDescription: '五片不规则火球区域',
    visual: 'fire',
    color: 0xff7048,
    damageMultiplier: 1.4,
    defenseMultiplier: 0.4,
    chargeTurns: 1,
  },
  {
    id: 'void-rift',
    name: '虚空裂界',
    description: '沿目标斜线撕开两道虚空裂隙，蓄力时召唤虚空侍从并刷新护盾；半血后会随机改用湮灭十字。',
    dangerDescription: '两条斜线各 5 格',
    visual: 'void',
    color: 0xc18cff,
    damageMultiplier: 1.25,
    defenseMultiplier: 0.2,
    chargeTurns: 1,
  },
  {
    id: 'annihilation-cross',
    name: '湮灭十字',
    description: '锁定目标所在横纵列，持续蓄力两回合后引爆十字形虚空冲击。',
    dangerDescription: '横纵各 5 格',
    visual: 'nova',
    color: 0x66e0d0,
    damageMultiplier: 1.35,
    defenseMultiplier: 0.15,
    chargeTurns: 2,
  },
];

export function getBossSkill(floor: number): BossSkillDefinition {
  return BOSS_SKILLS[Math.min(getRegionIndex(floor), FIFTH_BOSS_REGION_INDEX)];
}

export function getBossSkillById(id: BossSkillId): BossSkillDefinition {
  return BOSS_SKILLS.find((skill) => skill.id === id) ?? BOSS_SKILLS[0];
}

export function getBossSkillForPhase(
  floor: number,
  secondPhase: boolean,
  roll: number,
): BossSkillDefinition {
  const primary = getBossSkill(floor);
  if (getRegionIndex(floor) !== FIFTH_BOSS_REGION_INDEX || !secondPhase || roll < 0.5) return primary;
  return getBossSkillById('annihilation-cross');
}

export function shouldEnterBossSecondPhase(
  floor: number,
  hp: number,
  maxHp: number,
  alreadyEntered: boolean,
): boolean {
  return getRegionIndex(floor) === FIFTH_BOSS_REGION_INDEX &&
    !alreadyEntered &&
    hp > 0 &&
    maxHp > 0 &&
    hp * 2 <= maxHp;
}

export function getBossSkillTiles(
  skill: BossSkillDefinition,
  target: Point,
  tiles: Tile[][],
  random: () => number = () => 0.5,
  blocked: ReadonlySet<string> = new Set(),
): Point[] {
  if (skill.id === 'meteor') return getMeteorBarrageTiles(target, tiles, random, blocked);

  const offsets: Point[] = [];
  if (skill.id === 'rockfall') {
    for (let offset = -2; offset <= 2; offset += 1) offsets.push({ x: offset, y: 0 });
  } else if (skill.id === 'thunder') {
    for (let offset = -2; offset <= 2; offset += 1) offsets.push({ x: 0, y: offset });
  } else if (skill.id === 'spore-rain') {
    offsets.push({ x: 0, y: 0 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 });
  } else if (skill.id === 'void-rift') {
    for (let offset = -2; offset <= 2; offset += 1) {
      offsets.push({ x: offset, y: offset }, { x: offset, y: -offset });
    }
  } else {
    for (let offset = -2; offset <= 2; offset += 1) {
      offsets.push({ x: offset, y: 0 }, { x: 0, y: offset });
    }
  }

  const unique = new Map<string, Point>();
  for (const offset of offsets) {
    const point = { x: target.x + offset.x, y: target.y + offset.y };
    if (tiles[point.y]?.[point.x] !== 1) continue;
    unique.set(`${point.x},${point.y}`, point);
  }
  return [...unique.values()];
}

const METEOR_CLUSTER_SHAPES: readonly (readonly Point[])[] = [
  [
    { x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 },
    { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: -1, y: -1 },
  ],
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
    { x: 0, y: 1 }, { x: -1, y: 1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  ],
  [
    { x: 0, y: 0 }, { x: -1, y: 0 }, { x: -2, y: 0 },
    { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
  ],
];

function randomIndex(length: number, random: () => number): number {
  const roll = Math.min(0.999999, Math.max(0, random()));
  return Math.floor(roll * length);
}

function getMeteorBarrageTiles(
  target: Point,
  tiles: Tile[][],
  random: () => number,
  blocked: ReadonlySet<string>,
): Point[] {
  const walkable: Point[] = [];
  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < tiles[y].length; x += 1) {
      if (tiles[y][x] === 1) walkable.push({ x, y });
    }
  }

  const centers: Point[] = [{ ...target }];
  while (centers.length < 5) {
    const candidates = walkable.filter((point) => centers.every((center) =>
      Math.abs(point.x - center.x) + Math.abs(point.y - center.y) >= 4,
    ));
    if (candidates.length === 0) break;
    centers.push(candidates[randomIndex(candidates.length, random)]);
  }

  const danger = new Map<string, Point>();
  for (const center of centers) {
    const shape = METEOR_CLUSTER_SHAPES[randomIndex(METEOR_CLUSTER_SHAPES.length, random)];
    for (const offset of shape) {
      const point = { x: center.x + offset.x, y: center.y + offset.y };
      if (tiles[point.y]?.[point.x] !== 1) continue;
      danger.set(`${point.x},${point.y}`, point);
    }
  }

  const escapeTiles = [
    { x: target.x + 1, y: target.y },
    { x: target.x - 1, y: target.y },
    { x: target.x, y: target.y + 1 },
    { x: target.x, y: target.y - 1 },
  ].filter((point) => tiles[point.y]?.[point.x] === 1 && !blocked.has(`${point.x},${point.y}`));
  if (escapeTiles.length > 0) {
    const escape = escapeTiles[randomIndex(escapeTiles.length, random)];
    danger.delete(`${escape.x},${escape.y}`);
  }
  return [...danger.values()];
}

export function getBossSkillDamage(
  skill: BossSkillDefinition,
  bossAttack: number,
  playerDefense: number,
): number {
  const rawDamage = Math.round(bossAttack * skill.damageMultiplier) + 2;
  const mitigation = Math.floor(playerDefense * skill.defenseMultiplier);
  return Math.max(2, rawDamage - mitigation);
}

export function getBossChargeReinforcement(
  floor: number,
  bossMaxHp: number,
  activeSummons: number,
): BossChargeReinforcement {
  if (getRegionIndex(floor) !== FIFTH_BOSS_REGION_INDEX) {
    return { shield: 0, summonCount: 0 };
  }
  return {
    shield: Math.max(1, Math.ceil(Math.max(1, bossMaxHp) * FIFTH_BOSS_SHIELD_RATIO)),
    summonCount: Math.min(
      FIFTH_BOSS_SUMMON_COUNT,
      Math.max(0, FIFTH_BOSS_SUMMON_CAP - Math.max(0, Math.floor(activeSummons))),
    ),
  };
}

export function getThirdBossReleaseSummonCount(floor: number, activeSummons: number): number {
  if (getRegionIndex(floor) !== THIRD_BOSS_REGION_INDEX) return 0;
  return Math.min(2, Math.max(0, THIRD_BOSS_SUMMON_CAP - Math.max(0, Math.floor(activeSummons))));
}

export function shouldStartFourthBossHealing(
  floor: number,
  hp: number,
  maxHp: number,
  completedPhases: number,
): boolean {
  if (
    getRegionIndex(floor) !== FOURTH_BOSS_REGION_INDEX ||
    hp <= 0 ||
    maxHp <= 0 ||
    completedPhases >= 2
  ) {
    return false;
  }
  const remainingThirds = completedPhases === 0 ? 2 : 1;
  return hp * 3 <= maxHp * remainingThirds;
}

export function getFourthBossHealingAmount(maxHp: number, roll: number): number {
  const lostThird = Math.max(1, maxHp) / 3;
  const minimum = Math.max(1, Math.ceil(lostThird / 5));
  const maximum = Math.max(minimum, Math.ceil(lostThird / 3));
  const normalizedRoll = Math.min(0.999999, Math.max(0, roll));
  return minimum + Math.floor(normalizedRoll * (maximum - minimum + 1));
}

export function getFourthBossBurnDamage(playerMaxHp: number): number {
  return Math.max(3, Math.ceil(Math.max(1, playerMaxHp) * 0.05));
}

export function resolveShieldDamage(shield: number, incomingDamage: number): ShieldDamageResult {
  const normalizedShield = Math.max(0, Math.floor(shield));
  const normalizedDamage = Math.max(0, Math.floor(incomingDamage));
  const absorbed = Math.min(normalizedShield, normalizedDamage);
  return {
    absorbed,
    healthDamage: normalizedDamage - absorbed,
    remainingShield: normalizedShield - absorbed,
  };
}
