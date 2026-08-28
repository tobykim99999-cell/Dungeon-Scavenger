import type Phaser from 'phaser';

export type RunStatus = 'waiting' | 'active' | 'dead' | 'escaped';
export type ItemType = 'potion' | 'weapon' | 'armor' | 'scroll';
export type Rarity = 'common' | 'uncommon' | 'rare';
export type MoveDirection = 'up' | 'down' | 'left' | 'right';

export interface Item {
  id: string;
  type: ItemType;
  name: string;
  description: string;
  power: number;
  rarity: Rarity;
}

export interface Equipment {
  name: string;
  power: number;
}

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
  alerted: boolean;
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
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  gold: number;
  bankedGold: number;
  weapon: Equipment;
  armor: Equipment;
  inventory: Item[];
  log: string[];
  muted: boolean;
}

export type GameCommand =
  | { action: 'start' }
  | { action: 'move'; direction: MoveDirection }
  | { action: 'use-item'; index: number }
  | { action: 'escape' }
  | { action: 'mute' };

export const UI_EVENT = 'abyss:ui-state';
export const COMMAND_EVENT = 'abyss:command';
