import { getRegionIndex } from './regions';
import type { Point, Tile } from './dungeon';

export type BossSkillId = 'rockfall' | 'thunder' | 'spore-rain' | 'meteor' | 'void-rift';
export type BossSkillVisual = 'quake' | 'lightning' | 'poison' | 'fire' | 'void';

export interface BossSkillDefinition {
  id: BossSkillId;
  name: string;
  description: string;
  dangerDescription: string;
  visual: BossSkillVisual;
  color: number;
  damageMultiplier: number;
  defenseMultiplier: number;
}

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
  },
  {
    id: 'spore-rain',
    name: '孢子蚀雨',
    description: '在目标与四个斜角播下腐蚀孢子。',
    dangerDescription: '目标格与四个斜角',
    visual: 'poison',
    color: 0x9edb63,
    damageMultiplier: 0.9,
    defenseMultiplier: 0.35,
  },
  {
    id: 'meteor',
    name: '陨火天坠',
    description: '锁定目标格召来高伤害陨火。',
    dangerDescription: '目标单格',
    visual: 'fire',
    color: 0xff7048,
    damageMultiplier: 1.4,
    defenseMultiplier: 0.4,
  },
  {
    id: 'void-rift',
    name: '虚空裂界',
    description: '沿目标斜线撕开两道虚空裂隙。',
    dangerDescription: '两条斜线各 5 格',
    visual: 'void',
    color: 0xc18cff,
    damageMultiplier: 1.25,
    defenseMultiplier: 0.2,
  },
];

export function getBossSkill(floor: number): BossSkillDefinition {
  return BOSS_SKILLS[Math.min(getRegionIndex(floor), BOSS_SKILLS.length - 1)];
}

export function getBossSkillById(id: BossSkillId): BossSkillDefinition {
  return BOSS_SKILLS.find((skill) => skill.id === id) ?? BOSS_SKILLS[0];
}

export function getBossSkillTiles(
  skill: BossSkillDefinition,
  target: Point,
  tiles: Tile[][],
): Point[] {
  const offsets: Point[] = [];
  if (skill.id === 'rockfall') {
    for (let offset = -2; offset <= 2; offset += 1) offsets.push({ x: offset, y: 0 });
  } else if (skill.id === 'thunder') {
    for (let offset = -2; offset <= 2; offset += 1) offsets.push({ x: 0, y: offset });
  } else if (skill.id === 'spore-rain') {
    offsets.push({ x: 0, y: 0 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 });
  } else if (skill.id === 'meteor') {
    offsets.push({ x: 0, y: 0 });
  } else {
    for (let offset = -2; offset <= 2; offset += 1) {
      offsets.push({ x: offset, y: offset }, { x: offset, y: -offset });
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

export function getBossSkillDamage(
  skill: BossSkillDefinition,
  bossAttack: number,
  playerDefense: number,
): number {
  const rawDamage = Math.round(bossAttack * skill.damageMultiplier) + 2;
  const mitigation = Math.floor(playerDefense * skill.defenseMultiplier);
  return Math.max(2, rawDamage - mitigation);
}
