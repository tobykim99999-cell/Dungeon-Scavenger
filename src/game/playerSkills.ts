export type PlayerSkillId = 'charged-strike' | 'guard' | 'shockwave' | 'cleanse';

export interface PlayerSkillDefinition {
  id: PlayerSkillId;
  name: string;
  description: string;
  cooldown: number;
}

export type PlayerSkillCooldowns = Record<PlayerSkillId, number>;

export const PLAYER_SKILLS: readonly PlayerSkillDefinition[] = [
  {
    id: 'charged-strike',
    name: '蓄力斩',
    description: '消耗一回合，下一次近战攻击造成 180% 伤害并忽略目标 30% 防御。',
    cooldown: 4,
  },
  {
    id: 'guard',
    name: '架盾',
    description: '下一次直接伤害降低 50%，并抵挡该次攻击附带的控制与灼烧。',
    cooldown: 4,
  },
  {
    id: 'shockwave',
    name: '震荡波',
    description: '同时攻击角色上下左右四格内的所有敌人。',
    cooldown: 5,
  },
  {
    id: 'cleanse',
    name: '净化',
    description: '解除禁锢和灼烧；被控制时仍可使用。',
    cooldown: 8,
  },
];

export function createPlayerSkillCooldowns(): PlayerSkillCooldowns {
  return {
    'charged-strike': 0,
    guard: 0,
    shockwave: 0,
    cleanse: 0,
  };
}

export function tickPlayerSkillCooldowns(
  cooldowns: PlayerSkillCooldowns,
  excluded?: PlayerSkillId,
): PlayerSkillCooldowns {
  return Object.fromEntries(
    PLAYER_SKILLS.map((skill) => [
      skill.id,
      skill.id === excluded ? cooldowns[skill.id] : Math.max(0, cooldowns[skill.id] - 1),
    ]),
  ) as PlayerSkillCooldowns;
}

export function getChargedStrikeDamage(
  attack: number,
  defense: number,
  variance: number,
  critical: boolean,
): number {
  const effectiveDefense = Math.floor(Math.max(0, defense) * 0.7);
  const baseDamage = Math.max(1, Math.max(0, attack) - effectiveDefense + variance);
  return Math.max(1, Math.round(baseDamage * (critical ? 2 : 1) * 1.8));
}

export function getShockwaveDamage(attack: number, defense: number): number {
  return Math.max(1, Math.round(Math.max(0, attack) * 0.75) - Math.max(0, defense));
}

export function getGuardedDamage(incomingDamage: number): number {
  return Math.max(1, Math.ceil(Math.max(0, incomingDamage) * 0.5));
}
