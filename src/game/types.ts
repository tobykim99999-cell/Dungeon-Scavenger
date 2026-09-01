import type Phaser from 'phaser';

export type RunStatus = 'waiting' | 'town' | 'active' | 'dead' | 'escaped';
export type ItemType = 'potion' | 'weapon' | 'armor' | 'scroll';
export type Rarity = 'common' | 'uncommon' | 'rare';
export type EquipmentTier = 'common' | 'gold' | 'dark-gold' | 'purple';
export type BonusStat = 'attack' | 'defense';
export type MoveDirection = 'up' | 'down' | 'left' | 'right';
export const INVENTORY_CAPACITY = 18;

export interface Item {
  id: string;
  type: ItemType;
  name: string;
  description: string;
  power: number;
  rarity: Rarity;
  gilded?: boolean;
  vaultId?: string;
  quantity?: number;
  tier?: EquipmentTier;
  affixes?: EquipmentAffix[];
  setId?: string;
  setName?: string;
  setBonus?: EquipmentAffix;
}

export interface Equipment {
  name: string;
  power: number;
  rarity?: Rarity;
  gilded?: boolean;
  vaultId?: string;
  tier?: EquipmentTier;
  affixes?: EquipmentAffix[];
  setId?: string;
  setName?: string;
  setBonus?: EquipmentAffix;
}

export interface EquipmentAffix {
  stat: BonusStat;
  value: number;
  label: string;
}

export interface Altar {
  x: number;
  y: number;
  used: boolean;
  sprite?: Phaser.GameObjects.Sprite;
}

export interface GildingOption {
  targetId: string;
  name: string;
  type: 'weapon' | 'armor';
  power: number;
  source: 'equipped' | 'inventory';
}

export interface TownLoadoutOption {
  targetId: string;
  name: string;
  type: 'weapon' | 'armor';
  power: number;
  rarity: Rarity;
  tier: EquipmentTier;
  affixes: EquipmentAffix[];
  setName?: string;
  setBonus?: EquipmentAffix;
  equipped: boolean;
  starter: boolean;
}

export interface RegionOption {
  index: number;
  name: string;
  startFloor: number;
  endFloor: number;
}

interface DiscardCandidateBase {
  name: string;
  type: ItemType;
  gilded: boolean;
  quantity: number;
}

export type DiscardCandidate =
  | (DiscardCandidateBase & { source: 'run'; index: number })
  | (DiscardCandidateBase & { source: 'vault'; targetId: string });

export interface Enemy {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  reward: number;
  frame: number;
  tint: number;
  scale: number;
  alerted: boolean;
  isBoss: boolean;
  sprite?: Phaser.GameObjects.Sprite;
}

export interface Chest {
  id: string;
  x: number;
  y: number;
  loot: Item;
  sprite?: Phaser.GameObjects.Sprite;
}

export interface UiState {
  status: RunStatus;
  floor: number;
  inTown: boolean;
  areaLabel: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  gold: number;
  bankedGold: number;
  weapon: Equipment;
  armor: Equipment;
  inventory: Item[];
  inventoryCapacity: number;
  log: string[];
  muted: boolean;
  isBossFloor: boolean;
  canReturnToTown: boolean;
  gildingOptions: GildingOption[] | null;
  pendingGilded: Equipment[];
  townLoadoutOptions: TownLoadoutOption[] | null;
  regionOptions: RegionOption[] | null;
  discardCandidate: DiscardCandidate | null;
  activeSetBonus: { setName: string; affix: EquipmentAffix } | null;
  boss: {
    name: string;
    hp: number;
    maxHp: number;
  } | null;
}

export type GameCommand =
  | { action: 'start' }
  | { action: 'enter-town' }
  | { action: 'move'; direction: MoveDirection }
  | { action: 'use-item'; index: number }
  | { action: 'escape' }
  | { action: 'return-town' }
  | { action: 'gild-item'; targetId: string }
  | { action: 'dismiss-gilding' }
  | { action: 'equip-town'; targetId: string }
  | { action: 'dismiss-town-loadout' }
  | { action: 'start-region'; regionIndex: number }
  | { action: 'dismiss-region-map' }
  | { action: 'request-discard'; index: number }
  | { action: 'request-vault-discard'; targetId: string }
  | { action: 'confirm-discard' }
  | { action: 'dismiss-discard' }
  | { action: 'mute' };

export const UI_EVENT = 'abyss:ui-state';
export const COMMAND_EVENT = 'abyss:command';
