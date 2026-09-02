import type Phaser from 'phaser';

export type RunStatus = 'waiting' | 'town' | 'active' | 'dead' | 'escaped';
export type ItemType = 'potion' | 'weapon' | 'armor' | 'scroll' | 'material';
export type Rarity = 'common' | 'uncommon' | 'rare';
export type EquipmentTier = 'common' | 'gold' | 'dark-gold' | 'purple';
export type BonusStat = 'attack' | 'defense' | 'maxHp' | 'crit' | 'bleed';
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
  enhancementLevel?: number;
  materialRegion?: number;
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
  enhancementLevel?: number;
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
  type: 'weapon' | 'armor' | 'material';
  power: number;
  source: 'equipped' | 'inventory';
  quantity?: number;
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
  enhancementLevel: number;
  equipped: boolean;
  starter: boolean;
}

export interface ArtisanOption {
  targetId: string;
  name: string;
  type: 'weapon' | 'armor';
  tier: EquipmentTier;
  power: number;
  enhancementLevel: number;
  maxLevel: number;
  nextCost: number;
  canEnhance: boolean;
  attackPerLevel: number;
  maxHpPerLevel: number;
  successChance: number;
}

export interface EnhancementConfirmation {
  targetId: string;
  name: string;
  nextLevel: number;
  cost: number;
  successChance: number;
}

export interface EnhancementResult {
  success: boolean;
  targetId: string;
  name: string;
  level: number;
  message: string;
}

export interface RegionOption {
  index: number;
  name: string;
  startFloor: number;
  endFloor: number;
}

export interface TownMaterialBalance {
  regionIndex: number;
  name: string;
  quantity: number;
}

export interface MerchantOffer extends TownMaterialBalance {
  regionName: string;
  cost: number;
  canBuy: boolean;
}

export interface MerchantReveal {
  sequence: number;
  regionName: string;
  name: string;
  type: 'weapon' | 'armor';
  power: number;
  tier: EquipmentTier;
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
  bleedDamage?: number;
  bleedTurns?: number;
  sprite?: Phaser.GameObjects.Sprite;
}

export interface Chest {
  id: string;
  x: number;
  y: number;
  loot?: Item;
  sprite?: Phaser.GameObjects.Sprite;
  effect?: Phaser.GameObjects.Container;
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
  artisanOptions: ArtisanOption[] | null;
  artisanSelectedId: string | null;
  enhancementConfirmation: EnhancementConfirmation | null;
  enhancementResult: EnhancementResult | null;
  regionOptions: RegionOption[] | null;
  discardCandidate: DiscardCandidate | null;
  activeSetBonus: { setName: string; affix: EquipmentAffix } | null;
  pendingMaterials: TownMaterialBalance[];
  townMaterials: TownMaterialBalance[];
  merchantOffers: MerchantOffer[] | null;
  merchantReveal: MerchantReveal | null;
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
  | { action: 'enhance-equipment'; targetId: string }
  | { action: 'select-artisan-equipment'; targetId: string }
  | { action: 'confirm-enhancement' }
  | { action: 'dismiss-enhancement-confirmation' }
  | { action: 'dismiss-artisan' }
  | { action: 'start-region'; regionIndex: number }
  | { action: 'dismiss-region-map' }
  | { action: 'request-discard'; index: number }
  | { action: 'request-vault-discard'; targetId: string }
  | { action: 'confirm-discard' }
  | { action: 'dismiss-discard' }
  | { action: 'buy-region-jar'; regionIndex: number }
  | { action: 'dismiss-merchant-reveal' }
  | { action: 'dismiss-merchant' }
  | { action: 'mute' };

export const UI_EVENT = 'abyss:ui-state';
export const COMMAND_EVENT = 'abyss:command';
