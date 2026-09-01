import { getRegionIndex } from './regions';

export interface RegionEnemyTheme {
  name: string;
  frame: number;
  tint: number;
  scale: number;
  hp: number;
  attack: number;
  defense: number;
  reward: number;
}

export interface RegionTheme {
  id: string;
  name: string;
  floorColors: readonly [number, number];
  floorLine: number;
  wallFrame: number;
  wallTint: number;
  fogColor: number;
  exploredFogAlpha: number;
  chestTint: number;
  exitTint: number;
  decorationFrame: number;
  decorationTint: number;
  enemies: readonly [RegionEnemyTheme, RegionEnemyTheme, RegionEnemyTheme];
  boss: Pick<RegionEnemyTheme, 'name' | 'frame' | 'tint' | 'scale'>;
}

const REGION_THEMES: readonly RegionTheme[] = [
  {
    id: 'gray-mine',
    name: '灰岩矿脉',
    floorColors: [0x3f4744, 0x3a423f],
    floorLine: 0x343a38,
    wallFrame: 28,
    wallTint: 0xaebbc0,
    fogColor: 0x080a0b,
    exploredFogAlpha: 0.68,
    chestTint: 0xf0c56b,
    exitTint: 0xb7d7c2,
    decorationFrame: 24,
    decorationTint: 0x77817c,
    enemies: [
      { name: '噬石虫', frame: 123, tint: 0xd3a276, scale: 2, hp: 5, attack: 3, defense: 0, reward: 3 },
      { name: '矿坑幽魂', frame: 108, tint: 0x6fd0ba, scale: 2, hp: 7, attack: 4, defense: 0, reward: 5 },
      { name: '铁面监工', frame: 122, tint: 0xaab7bd, scale: 2, hp: 11, attack: 5, defense: 1, reward: 8 },
    ],
    boss: { name: '灰岩监工长', frame: 122, tint: 0xd46f68, scale: 3 },
  },
  {
    id: 'sunken-gallery',
    name: '沉没回廊',
    floorColors: [0x31555a, 0x294a50],
    floorLine: 0x254147,
    wallFrame: 57,
    wallTint: 0x70a1aa,
    fogColor: 0x071216,
    exploredFogAlpha: 0.64,
    chestTint: 0x71c9bd,
    exitTint: 0x8dd7d0,
    decorationFrame: 51,
    decorationTint: 0x78c8c4,
    enemies: [
      { name: '潮壳潜兽', frame: 120, tint: 0x52b8a8, scale: 2.1, hp: 5, attack: 3, defense: 0, reward: 3 },
      { name: '溺亡侍从', frame: 121, tint: 0x76c9db, scale: 2, hp: 7, attack: 4, defense: 0, reward: 5 },
      { name: '珊瑚守卫', frame: 122, tint: 0x68a9b0, scale: 2.15, hp: 11, attack: 5, defense: 1, reward: 8 },
    ],
    boss: { name: '溺亡司祭', frame: 121, tint: 0x48d0cf, scale: 3.2 },
  },
  {
    id: 'forgotten-well',
    name: '遗忘深井',
    floorColors: [0x394238, 0x303a32],
    floorLine: 0x29332b,
    wallFrame: 58,
    wallTint: 0x72836f,
    fogColor: 0x0d0a12,
    exploredFogAlpha: 0.7,
    chestTint: 0xa5d269,
    exitTint: 0xb38adb,
    decorationFrame: 32,
    decorationTint: 0x9ad56c,
    enemies: [
      { name: '菌冠爬兽', frame: 123, tint: 0x8dcc62, scale: 2.15, hp: 5, attack: 3, defense: 0, reward: 3 },
      { name: '失忆咒灵', frame: 108, tint: 0xad76d2, scale: 2.15, hp: 7, attack: 4, defense: 0, reward: 5 },
      { name: '深井守望者', frame: 122, tint: 0x7d6797, scale: 2.25, hp: 11, attack: 5, defense: 1, reward: 8 },
    ],
    boss: { name: '菌冠守望者', frame: 108, tint: 0xbb70e0, scale: 3.35 },
  },
  {
    id: 'molten-fault',
    name: '熔火断层',
    floorColors: [0x4a332e, 0x3e2926],
    floorLine: 0x31201e,
    wallFrame: 59,
    wallTint: 0xa75f4b,
    fogColor: 0x130807,
    exploredFogAlpha: 0.66,
    chestTint: 0xf2a34f,
    exitTint: 0xf0784f,
    decorationFrame: 29,
    decorationTint: 0xff7048,
    enemies: [
      { name: '熔核甲虫', frame: 120, tint: 0xf06b43, scale: 2.2, hp: 5, attack: 3, defense: 0, reward: 3 },
      { name: '余烬亡魂', frame: 108, tint: 0xff8a45, scale: 2.2, hp: 7, attack: 4, defense: 0, reward: 5 },
      { name: '锻炉重卫', frame: 122, tint: 0xc94e38, scale: 2.35, hp: 11, attack: 5, defense: 1, reward: 8 },
    ],
    boss: { name: '熔炉暴君', frame: 122, tint: 0xff513d, scale: 3.5 },
  },
  {
    id: 'lightless-ruins',
    name: '无光遗迹',
    floorColors: [0x252d33, 0x20272d],
    floorLine: 0x181e23,
    wallFrame: 1,
    wallTint: 0x536571,
    fogColor: 0x05070c,
    exploredFogAlpha: 0.76,
    chestTint: 0x8069d0,
    exitTint: 0x55d0c4,
    decorationFrame: 60,
    decorationTint: 0x49b8b4,
    enemies: [
      { name: '虚空孽物', frame: 123, tint: 0x6552a4, scale: 2.25, hp: 5, attack: 3, defense: 0, reward: 3 },
      { name: '无光残影', frame: 121, tint: 0x4ac4b8, scale: 2.25, hp: 7, attack: 4, defense: 0, reward: 5 },
      { name: '遗迹黑骑', frame: 122, tint: 0x65577e, scale: 2.45, hp: 11, attack: 5, defense: 1, reward: 8 },
    ],
    boss: { name: '无光君王', frame: 121, tint: 0x8b62d0, scale: 3.65 },
  },
];

export function getRegionTheme(floor: number): RegionTheme {
  return REGION_THEMES[Math.min(getRegionIndex(floor), REGION_THEMES.length - 1)];
}

export function listRegionThemes(): readonly RegionTheme[] {
  return REGION_THEMES;
}
