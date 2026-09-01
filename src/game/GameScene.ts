import Phaser from 'phaser';
import {
  collectWalkableTiles,
  createRandom,
  generateBossArena,
  generateDungeon,
  generateTownMap,
  isWalkable,
  MAP_HEIGHT,
  MAP_WIDTH,
  type Dungeon,
  type Point,
  type RandomSource,
} from './dungeon';
import { computeFieldOfView } from './fov';
import {
  equipmentAffixBonus,
  equipmentStorageId,
  equipmentTierLabel,
  getEquipmentTier,
  isCarryableEquipment,
  resolveSetBonus,
  shouldDropDarkGoldFromChest,
  shouldDropPurpleFromBoss,
} from './equipment';
import { canStackItems, itemQuantity } from './inventory';
import {
  chooseAltarFloors,
  chooseEscapeScrollFloor,
  canGildEquipment,
  deleteVaultEquipment,
  equipmentMatchesItem,
  GILDED_LOADOUT_KEY,
  GILDED_VAULT_KEY,
  mergeGildedEquipment,
  mergePendingGildedEquipment,
  parseGildedLoadout,
  parseGildedVault,
  parseTownLoadout,
  shouldPlaceEscapeScroll,
  TOWN_LOADOUT_KEY,
  type PendingGildedEquipment,
  type TownLoadoutSelection,
  type VaultEquipment,
} from './gilding';
import { advanceStage, getBossStats, getEnemyCount } from './progression';
import { getRegionTheme } from './themes';
import {
  getRegion,
  parseRegionProgress,
  REGION_PROGRESS_KEY,
  unlockRegion,
} from './regions';
import {
  COMMAND_EVENT,
  INVENTORY_CAPACITY,
  UI_EVENT,
  type Altar,
  type Chest,
  type DiscardCandidate,
  type Enemy,
  type Equipment,
  type EquipmentAffix,
  type EquipmentTier,
  type GameCommand,
  type GildingOption,
  type Item,
  type ItemType,
  type MoveDirection,
  type Rarity,
  type RegionOption,
  type RunStatus,
  type TownLoadoutOption,
  type UiState,
} from './types';

const TILE_SIZE = 32;
const FOV_RADIUS = 7;
const ASSET_ROOT = `${import.meta.env.BASE_URL}assets`;
const TOWN_CHEST = { x: 8, y: 10 };

const PURPLE_SETS: Array<{
  id: string;
  name: string;
  bonus: EquipmentAffix;
}> = [
  { id: 'grave-oath', name: '守墓誓约', bonus: { stat: 'attack', value: 5, label: '誓约之刃' } },
  { id: 'deep-echo', name: '深渊回响', bonus: { stat: 'defense', value: 5, label: '回响壁垒' } },
  { id: 'ember-crown', name: '余烬王冠', bonus: { stat: 'attack', value: 4, label: '余烬共鸣' } },
];

interface PlayerState extends Point {
  hp: number;
  maxHp: number;
  baseAttack: number;
  baseDefense: number;
}

interface Step {
  x: number;
  y: number;
}

export class GameScene extends Phaser.Scene {
  private status: RunStatus = 'waiting';
  private inTown = false;
  private floor = 1;
  private gold = 0;
  private bankedGold = 0;
  private player: PlayerState = { x: 0, y: 0, hp: 24, maxHp: 24, baseAttack: 2, baseDefense: 0 };
  private weapon: Equipment = { name: '缺口短剑', power: 2 };
  private armor: Equipment = { name: '旧皮甲', power: 1 };
  private inventory: Item[] = [];
  private logEntries: string[] = [];
  private dungeon!: Dungeon;
  private enemies: Enemy[] = [];
  private chests: Chest[] = [];
  private altar?: Altar;
  private townChestSprite?: Phaser.GameObjects.Sprite;
  private explored = new Set<string>();
  private visible = new Set<string>();
  private bossStage = false;
  private bossDefeated = true;
  private altarFloors = new Map<number, Set<number>>();
  private gildingOptions: GildingOption[] | null = null;
  private pendingGilded: PendingGildedEquipment[] = [];
  private vault: VaultEquipment[] = [];
  private townLoadout: TownLoadoutSelection = {};
  private townLoadoutOptions: TownLoadoutOption[] | null = null;
  private regionOptions: RegionOption[] | null = null;
  private discardCandidate: DiscardCandidate | null = null;
  private highestUnlockedRegion = 0;
  private escapeScrollFloor = 1;
  private random: RandomSource = createRandom(Date.now());
  private itemSerial = 0;

  private mapGroup!: Phaser.GameObjects.Group;
  private objectGroup!: Phaser.GameObjects.Group;
  private actorGroup!: Phaser.GameObjects.Group;
  private fogGraphics!: Phaser.GameObjects.Graphics;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private exitSprite!: Phaser.GameObjects.Sprite;

  private readonly commandListener = (event: Event) => {
    this.handleCommand((event as CustomEvent<GameCommand>).detail);
  };

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.spritesheet('tiny-dungeon', `${ASSET_ROOT}/kenney-tiny-dungeon/Tilemap/tilemap_packed.png`, {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.audio('step', `${ASSET_ROOT}/kenney-rpg-audio/Audio/footstep04.ogg`);
    this.load.audio('hit', `${ASSET_ROOT}/kenney-rpg-audio/Audio/knifeSlice.ogg`);
    this.load.audio('coins', `${ASSET_ROOT}/kenney-rpg-audio/Audio/handleCoins.ogg`);
    this.load.audio('open', `${ASSET_ROOT}/kenney-rpg-audio/Audio/doorOpen_2.ogg`);
    this.load.audio('equip', `${ASSET_ROOT}/kenney-rpg-audio/Audio/clothBelt2.ogg`);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d1012');
    this.cameras.main.setRoundPixels(true);
    this.mapGroup = this.add.group();
    this.objectGroup = this.add.group();
    this.actorGroup = this.add.group();
    this.fogGraphics = this.add.graphics().setDepth(20);
    this.bankedGold = Number.parseInt(localStorage.getItem('abyss-banked-gold') ?? '0', 10) || 0;

    this.bindKeyboard();
    window.addEventListener(COMMAND_EVENT, this.commandListener);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(COMMAND_EVENT, this.commandListener);
    });

    this.enterTown('远征者回到了灰炉镇。');
  }

  private bindKeyboard(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.repeat) return;

      const movement: Record<string, MoveDirection> = {
        ArrowUp: 'up',
        KeyW: 'up',
        ArrowDown: 'down',
        KeyS: 'down',
        ArrowLeft: 'left',
        KeyA: 'left',
        ArrowRight: 'right',
        KeyD: 'right',
      };
      const direction = movement[event.code];
      if (direction) {
        event.preventDefault();
        this.handleCommand({ action: 'move', direction });
        return;
      }

      if (/^Digit[1-9]$/.test(event.code)) {
        this.handleCommand({ action: 'use-item', index: Number(event.code.slice(-1)) - 1 });
      } else if (event.code === 'Digit0') {
        this.handleCommand({ action: 'use-item', index: 9 });
      } else if (event.code === 'KeyE') {
        this.handleCommand({ action: 'escape' });
      } else if (event.code === 'Escape') {
        this.handleCommand({
          action: this.discardCandidate
            ? 'dismiss-discard'
            : (this.regionOptions
            ? 'dismiss-region-map'
            : (this.townLoadoutOptions ? 'dismiss-town-loadout' : 'dismiss-gilding')),
        });
      }
    });
  }

  private handleCommand(command: GameCommand): void {
    if (command.action === 'start') {
      this.enterTown('整备之后，再从矿门出发。');
      return;
    }
    if (command.action === 'enter-town') {
      this.enterTown('本次远征已经放弃。');
      return;
    }
    if (command.action === 'mute') {
      this.sound.mute = !this.sound.mute;
      this.emitUiState();
      return;
    }
    if (command.action === 'dismiss-discard') {
      this.discardCandidate = null;
      this.emitUiState();
      return;
    }
    if (command.action === 'confirm-discard') {
      this.confirmDiscard();
      return;
    }
    if (this.discardCandidate) return;
    if (command.action === 'dismiss-region-map') {
      this.regionOptions = null;
      this.emitUiState();
      return;
    }
    if (command.action === 'start-region') {
      this.startRegion(command.regionIndex);
      return;
    }
    if (this.regionOptions) return;
    if (command.action === 'dismiss-town-loadout') {
      this.townLoadoutOptions = null;
      this.emitUiState();
      return;
    }
    if (command.action === 'equip-town') {
      this.equipTownItem(command.targetId);
      return;
    }
    if (command.action === 'request-vault-discard') {
      this.requestVaultDiscard(command.targetId);
      return;
    }
    if (this.townLoadoutOptions) return;

    if (this.status === 'town') {
      if (command.action === 'move') {
        const directions: Record<MoveDirection, Step> = {
          up: { x: 0, y: -1 },
          down: { x: 0, y: 1 },
          left: { x: -1, y: 0 },
          right: { x: 1, y: 0 },
        };
        this.attemptTownMove(directions[command.direction]);
      }
      return;
    }

    if (this.status !== 'active') return;

    if (command.action === 'request-discard') {
      if (this.gildingOptions) return;
      this.requestDiscard(command.index);
      return;
    }

    if (command.action === 'dismiss-gilding') {
      this.gildingOptions = null;
      this.emitUiState();
      return;
    }
    if (command.action === 'gild-item') {
      this.gildEquipment(command.targetId);
      return;
    }
    if (this.gildingOptions) return;

    if (command.action === 'move') {
      const directions: Record<MoveDirection, Step> = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
      };
      this.attemptMove(directions[command.direction]);
    } else if (command.action === 'use-item') {
      this.useItem(command.index);
    } else if (command.action === 'escape') {
      this.escapeDungeon();
    } else if (command.action === 'return-town') {
      this.returnToTown();
    }
  }

  private resetRun(status: RunStatus, startFloor = 1): void {
    this.status = status;
    this.inTown = false;
    this.floor = startFloor;
    this.bossStage = false;
    this.gold = 0;
    this.player = { x: 0, y: 0, hp: 24, maxHp: 24, baseAttack: 2, baseDefense: 0 };
    this.loadTownStorage();
    this.applyTownLoadout();
    this.inventory = [];
    this.pendingGilded = [];
    this.gildingOptions = null;
    this.townLoadoutOptions = null;
    this.regionOptions = null;
    this.discardCandidate = null;
    this.altarFloors.clear();
    this.logEntries = status === 'active' ? ['铁门在身后合拢。'] : [];
    this.random = createRandom((Date.now() ^ 0xa51b3c7d) >>> 0);
    this.escapeScrollFloor = chooseEscapeScrollFloor(startFloor, () => this.random.next());
    this.buildLevel();
  }

  private enterTown(message: string): void {
    this.status = 'town';
    this.inTown = true;
    this.floor = 1;
    this.bossStage = false;
    this.bossDefeated = true;
    this.gold = 0;
    this.player = { x: 0, y: 0, hp: 24, maxHp: 24, baseAttack: 2, baseDefense: 0 };
    this.inventory = [];
    this.pendingGilded = [];
    this.gildingOptions = null;
    this.townLoadoutOptions = null;
    this.regionOptions = null;
    this.discardCandidate = null;
    this.altarFloors.clear();
    this.loadTownStorage();
    this.highestUnlockedRegion = parseRegionProgress(localStorage.getItem(REGION_PROGRESS_KEY));
    this.applyTownLoadout();
    this.logEntries = [message];

    this.clearLevel();
    this.dungeon = generateTownMap();
    this.player.x = this.dungeon.start.x;
    this.player.y = this.dungeon.start.y;
    this.explored = new Set<string>();
    this.renderMap();
    this.renderTownObjects();
    this.updateVision();
    this.emitUiState();
  }

  private buildLevel(): void {
    this.clearLevel();
    const seed = (Date.now() ^ (this.floor * 0x9e3779b1) ^ Math.floor(this.random.next() * 0xffffffff)) >>> 0;
    this.dungeon = this.bossStage ? generateBossArena(seed) : generateDungeon(seed);
    this.player.x = this.dungeon.start.x;
    this.player.y = this.dungeon.start.y;
    this.explored = new Set<string>();
    this.bossDefeated = !this.bossStage;

    this.renderMap();
    this.spawnLevelContent();
    this.renderActorsAndObjects();
    this.updateVision();
    if (this.bossStage) this.pushLog(`第 ${this.floor} 层守层者正在大殿中等待。`);
    this.emitUiState();
  }

  private clearLevel(): void {
    this.mapGroup?.clear(true, true);
    this.objectGroup?.clear(true, true);
    this.actorGroup?.clear(true, true);
    this.fogGraphics?.clear();
    this.enemies = [];
    this.chests = [];
    this.altar = undefined;
    this.townChestSprite = undefined;
    this.gildingOptions = null;
    this.discardCandidate = null;
  }

  private renderMap(): void {
    const theme = getRegionTheme(this.floor);
    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const walkable = this.dungeon.tiles[y][x] === 1;
        const floorColor = this.inTown
          ? ((x + y) % 2 === 0 ? 0x566159 : 0x4e5952)
          : theme.floorColors[(x + y) % 2];
        const background = this.add
          .rectangle(x * TILE_SIZE + 16, y * TILE_SIZE + 16, TILE_SIZE, TILE_SIZE, walkable ? floorColor : 0x171c20)
          .setDepth(0);
        this.mapGroup.add(background);

        if (walkable) {
          const grout = this.add
            .rectangle(x * TILE_SIZE + 16, y * TILE_SIZE + 16, TILE_SIZE - 2, TILE_SIZE - 2)
            .setStrokeStyle(1, this.inTown ? 0x465149 : theme.floorLine, 0.65)
            .setDepth(1);
          this.mapGroup.add(grout);
          if (!this.inTown && (x * 19 + y * 13 + this.floor) % 31 === 0) {
            const decoration = this.add
              .sprite(x * TILE_SIZE + 16, y * TILE_SIZE + 16, 'tiny-dungeon', theme.decorationFrame)
              .setScale(2)
              .setTint(theme.decorationTint)
              .setAlpha(0.28)
              .setDepth(1);
            this.mapGroup.add(decoration);
          }
        } else if (this.hasAdjacentFloor(x, y)) {
          const wallTile = this.add
            .sprite(x * TILE_SIZE + 16, y * TILE_SIZE + 16, 'tiny-dungeon', this.inTown ? 28 : theme.wallFrame)
            .setScale(2)
            .setTint(this.inTown ? 0x8fa191 : theme.wallTint)
            .setDepth(2);
          this.mapGroup.add(wallTile);
        }
      }
    }
  }

  private hasAdjacentFloor(x: number, y: number): boolean {
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (this.dungeon.tiles[y + offsetY]?.[x + offsetX] === 1) return true;
      }
    }
    return false;
  }

  private renderTownObjects(): void {
    this.exitSprite = this.add
      .sprite(this.dungeon.exit.x * TILE_SIZE + 16, this.dungeon.exit.y * TILE_SIZE + 16, 'tiny-dungeon', 33)
      .setScale(2.5)
      .setTint(0xb8cfad)
      .setDepth(5);
    this.objectGroup.add(this.exitSprite);

    this.townChestSprite = this.add
      .sprite(TOWN_CHEST.x * TILE_SIZE + 16, TOWN_CHEST.y * TILE_SIZE + 16, 'tiny-dungeon', 72)
      .setScale(2.2)
      .setTint(0xe1b85c)
      .setDepth(6);
    this.objectGroup.add(this.townChestSprite);

    const gateLabel = this.add
      .text(this.dungeon.exit.x * TILE_SIZE + 16, this.dungeon.exit.y * TILE_SIZE + 48, '远征地图', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '12px',
        color: '#dce7d5',
        backgroundColor: '#263029',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(7);
    const chestLabel = this.add
      .text(TOWN_CHEST.x * TILE_SIZE + 16, TOWN_CHEST.y * TILE_SIZE + 46, '装备箱', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '12px',
        color: '#f0dba7',
        backgroundColor: '#302a1d',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(7);
    this.objectGroup.addMultiple([gateLabel, chestLabel]);

    for (const point of [{ x: 7, y: 6 }, { x: 21, y: 6 }, { x: 7, y: 14 }, { x: 21, y: 14 }]) {
      const lantern = this.add
        .sprite(point.x * TILE_SIZE + 16, point.y * TILE_SIZE + 16, 'tiny-dungeon', 29)
        .setScale(2)
        .setTint(0xf1c36a)
        .setDepth(5);
      this.objectGroup.add(lantern);
    }

    this.playerSprite = this.add
      .sprite(this.player.x * TILE_SIZE + 16, this.player.y * TILE_SIZE + 16, 'tiny-dungeon', 87)
      .setScale(2)
      .setTint(0xf8efc4)
      .setDepth(8);
    this.actorGroup.add(this.playerSprite);
  }

  private attemptTownMove(step: Step): void {
    const target = { x: this.player.x + step.x, y: this.player.y + step.y };
    if (!isWalkable(this.dungeon.tiles, target)) return;
    if (target.x === TOWN_CHEST.x && target.y === TOWN_CHEST.y) {
      this.openTownLoadout();
      return;
    }
    if (target.x === this.dungeon.exit.x && target.y === this.dungeon.exit.y) {
      this.openRegionMap();
      return;
    }

    this.player.x = target.x;
    this.player.y = target.y;
    this.tweenToGrid(this.playerSprite, target);
    this.playSound('step', 0.18);
  }

  private openRegionMap(): void {
    this.highestUnlockedRegion = parseRegionProgress(localStorage.getItem(REGION_PROGRESS_KEY));
    this.regionOptions = Array.from(
      { length: this.highestUnlockedRegion + 1 },
      (_, index) => getRegion(index),
    );
    this.emitUiState();
  }

  private startRegion(regionIndex: number): void {
    if (
      this.status !== 'town' ||
      !this.regionOptions?.some((option) => option.index === regionIndex) ||
      regionIndex > this.highestUnlockedRegion
    ) {
      return;
    }
    const region = getRegion(regionIndex);
    this.regionOptions = null;
    this.resetRun('active', region.startFloor);
  }

  private unlockRegionAtFloor(floor: number): void {
    this.highestUnlockedRegion = unlockRegion(this.highestUnlockedRegion, floor);
    localStorage.setItem(REGION_PROGRESS_KEY, String(this.highestUnlockedRegion));
  }

  private spawnLevelContent(): void {
    const theme = getRegionTheme(this.floor);
    const positions = collectWalkableTiles(this.dungeon).filter(
      (point) =>
        this.distance(point, this.dungeon.start) > 4 &&
        !(point.x === this.dungeon.exit.x && point.y === this.dungeon.exit.y),
    );
    this.shuffle(positions);

    if (this.bossStage) {
      const stats = getBossStats(this.floor);
      this.enemies.push({
        id: `boss-${this.floor}`,
        name: theme.boss.name,
        x: this.dungeon.exit.x,
        y: this.dungeon.exit.y,
        hp: stats.hp,
        maxHp: stats.hp,
        attack: stats.attack,
        defense: stats.defense,
        reward: stats.reward,
        frame: theme.boss.frame,
        tint: theme.boss.tint,
        scale: theme.boss.scale,
        alerted: true,
        isBoss: true,
      });
      return;
    }

    const enemyCount = getEnemyCount(this.floor);
    for (let index = 0; index < enemyCount && positions.length > 0; index += 1) {
      const position = positions.pop()!;
      const template = theme.enemies[this.random.integer(0, theme.enemies.length - 1)];
      const scale = 1 + Math.max(0, this.floor - 1) * 0.18;
      const hp = Math.round(template.hp * scale);
      this.enemies.push({
        id: `enemy-${this.floor}-${index}`,
        name: template.name,
        x: position.x,
        y: position.y,
        hp,
        maxHp: hp,
        attack: Math.round(template.attack * scale),
        defense: template.defense + Math.floor(this.floor / 4),
        reward: template.reward + this.floor,
        frame: template.frame,
        tint: template.tint,
        scale: template.scale,
        alerted: false,
        isBoss: false,
      });
    }

    const chestCount = Math.min(3 + Math.floor(this.floor / 2), 5);
    const shouldOfferEscapeScroll = shouldPlaceEscapeScroll(
      this.floor,
      this.escapeScrollFloor,
      this.inventory.some((item) => item.type === 'scroll'),
      this.random.next(),
    );
    for (let index = 0; index < chestCount && positions.length > 0; index += 1) {
      const position = positions.pop()!;
      const holdsEscapeScroll = index === 0 && shouldOfferEscapeScroll;
      this.chests.push({
        id: `chest-${this.floor}-${index}`,
        x: position.x,
        y: position.y,
        loot: holdsEscapeScroll ? this.createItem('scroll') : this.createChestLoot(),
      });
    }

    if (this.shouldSpawnAltar() && positions.length > 0) {
      const position = positions.pop()!;
      this.altar = { x: position.x, y: position.y, used: false };
    }
  }

  private shouldSpawnAltar(): boolean {
    if (this.bossStage) return false;
    const blockStart = Math.floor((this.floor - 1) / 10) * 10 + 1;
    let scheduled = this.altarFloors.get(blockStart);
    if (!scheduled) {
      scheduled = new Set(chooseAltarFloors(blockStart, () => this.random.next()));
      this.altarFloors.set(blockStart, scheduled);
    }
    return scheduled.has(this.floor);
  }

  private renderActorsAndObjects(): void {
    const theme = getRegionTheme(this.floor);
    this.exitSprite = this.add
      .sprite(this.dungeon.exit.x * TILE_SIZE + 16, this.dungeon.exit.y * TILE_SIZE + 16, 'tiny-dungeon', 36)
      .setScale(2)
      .setTint(theme.exitTint)
      .setVisible(this.bossDefeated)
      .setDepth(5);
    this.objectGroup.add(this.exitSprite);

    for (const chest of this.chests) {
      chest.sprite = this.add
        .sprite(chest.x * TILE_SIZE + 16, chest.y * TILE_SIZE + 16, 'tiny-dungeon', 72)
        .setScale(2)
        .setTint(theme.chestTint)
        .setDepth(6);
      this.objectGroup.add(chest.sprite);
    }

    if (this.altar) {
      this.altar.sprite = this.add
        .sprite(this.altar.x * TILE_SIZE + 16, this.altar.y * TILE_SIZE + 16, 'tiny-dungeon', 32)
        .setScale(2.4)
        .setTint(0xe3bd61)
        .setDepth(6);
      this.objectGroup.add(this.altar.sprite);
      this.tweens.add({ targets: this.altar.sprite, alpha: 0.72, duration: 850, yoyo: true, repeat: -1 });
    }

    for (const enemy of this.enemies) {
      enemy.sprite = this.add
        .sprite(enemy.x * TILE_SIZE + 16, enemy.y * TILE_SIZE + 16, 'tiny-dungeon', enemy.frame)
        .setScale(enemy.scale)
        .setTint(enemy.tint)
        .setDepth(7);
      this.actorGroup.add(enemy.sprite);
    }

    this.playerSprite = this.add
      .sprite(this.player.x * TILE_SIZE + 16, this.player.y * TILE_SIZE + 16, 'tiny-dungeon', 87)
      .setScale(2)
      .setTint(0xf8efc4)
      .setDepth(8);
    this.actorGroup.add(this.playerSprite);
  }

  private attemptMove(step: Step): void {
    const target = { x: this.player.x + step.x, y: this.player.y + step.y };
    if (!isWalkable(this.dungeon.tiles, target)) return;

    const enemy = this.enemies.find((candidate) => candidate.x === target.x && candidate.y === target.y);
    if (enemy) {
      this.attackEnemy(enemy);
      this.finishTurn();
      return;
    }

    const chest = this.chests.find((candidate) => candidate.x === target.x && candidate.y === target.y);
    if (chest) {
      this.openChest(chest);
      this.finishTurn();
      return;
    }

    if (this.altar && !this.altar.used && this.altar.x === target.x && this.altar.y === target.y) {
      this.openGildingAltar();
      return;
    }

    if (
      target.x === this.dungeon.exit.x &&
      target.y === this.dungeon.exit.y &&
      this.bossStage &&
      !this.bossDefeated
    ) {
      this.pushLog('通往下层的楼梯还没有出现。');
      this.emitUiState();
      return;
    }

    this.player.x = target.x;
    this.player.y = target.y;
    this.tweenToGrid(this.playerSprite, target);
    this.playSound('step', 0.22);

    if (target.x === this.dungeon.exit.x && target.y === this.dungeon.exit.y) {
      const previousBossStage = this.bossStage;
      const nextStage = advanceStage(this.floor, this.bossStage);
      this.floor = nextStage.floor;
      this.bossStage = nextStage.bossStage;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 3);
      if (this.bossStage) {
        this.pushLog(`第 ${this.floor} 层尽头的大门缓缓开启。`);
      } else if (previousBossStage) {
        this.pushLog(`你离开守层大殿，进入第 ${this.floor} 层。`);
      } else {
        this.pushLog(`踏入第 ${this.floor} 层，空气更加沉重。`);
      }
      this.playSound('open', 0.42);
      this.buildLevel();
      return;
    }

    this.finishTurn();
  }

  private finishTurn(): void {
    this.updateVision();
    this.runEnemyTurns();
    this.updateVision();
    this.emitUiState();
  }

  private attackEnemy(enemy: Enemy): void {
    const damage = Math.max(1, this.totalAttack - enemy.defense + this.random.integer(-1, 1));
    enemy.hp -= damage;
    this.playSound('hit', 0.42);
    this.showDamage(enemy.x, enemy.y, damage, '#f6d06f');
    enemy.sprite?.setTintFill(0xf5dfc4);
    this.time.delayedCall(70, () => {
      if (!enemy.sprite?.active) return;
      enemy.sprite.setTint(enemy.tint);
    });

    if (enemy.hp > 0) {
      this.pushLog(`你击中${enemy.name}，造成 ${damage} 点伤害。`);
      enemy.alerted = true;
      return;
    }

    this.gold += enemy.reward;
    this.pushLog(`${enemy.name}倒下，找到 ${enemy.reward} 枚古币。`);
    this.playSound('coins', 0.28);
    enemy.sprite?.destroy();
    this.enemies = this.enemies.filter((candidate) => candidate.id !== enemy.id);

    if (enemy.isBoss) {
      this.bossDefeated = true;
      this.dungeon.exit = { x: enemy.x, y: enemy.y };
      this.exitSprite
        .setPosition(enemy.x * TILE_SIZE + 16, enemy.y * TILE_SIZE + 16)
        .setTint(getRegionTheme(this.floor).exitTint)
        .setVisible(true);
      const rewardType = this.random.next() < 0.5 ? 'weapon' : 'armor';
      const rewardTier: EquipmentTier = shouldDropPurpleFromBoss(this.floor) ? 'purple' : 'common';
      const reward = this.createItem(rewardType, 'rare', rewardTier);
      this.addItem(reward);
      this.pushLog(`守层者掉落了${equipmentTierLabel(getEquipmentTier(reward))}：${reward.name}。`);
      this.pushLog('守层者倒下，通往下层的楼梯出现了。');
    } else if (this.random.next() < 0.24) {
      this.addItem(this.createLoot());
    }
  }

  private runEnemyTurns(): void {
    for (const enemy of this.enemies) {
      const distance = this.distance(enemy, this.player);
      if (distance === 1) {
        this.enemyAttack(enemy);
        if (this.status === 'dead') return;
        continue;
      }

      if (distance <= FOV_RADIUS || this.visible.has(`${enemy.x},${enemy.y}`)) enemy.alerted = true;
      if (!enemy.alerted || distance > 11) continue;

      const next = this.chooseEnemyStep(enemy);
      if (!next) continue;
      enemy.x = next.x;
      enemy.y = next.y;
      if (enemy.sprite) this.tweenToGrid(enemy.sprite, next);
    }
  }

  private enemyAttack(enemy: Enemy): void {
    const damage = Math.max(1, enemy.attack - this.totalDefense + this.random.integer(0, 1));
    this.player.hp -= damage;
    this.pushLog(`${enemy.name}对你造成 ${damage} 点伤害。`);
    this.showDamage(this.player.x, this.player.y, damage, '#ff746c');
    this.cameras.main.shake(80, 0.0025);
    this.playerSprite.setTintFill(0xff746c);
    this.time.delayedCall(80, () => this.playerSprite.clearTint());

    if (this.player.hp > 0) return;
    this.player.hp = 0;
    this.status = 'dead';
    this.playerSprite.setTint(0x6e7173).setAngle(90);
    this.pushLog('火把熄灭了。本次收获遗落在洞中。');
    this.emitUiState();
  }

  private chooseEnemyStep(enemy: Enemy): Point | undefined {
    const horizontal: Step = { x: Math.sign(this.player.x - enemy.x), y: 0 };
    const vertical: Step = { x: 0, y: Math.sign(this.player.y - enemy.y) };
    const steps = Math.abs(this.player.x - enemy.x) >= Math.abs(this.player.y - enemy.y)
      ? [horizontal, vertical]
      : [vertical, horizontal];

    for (const step of steps) {
      if (step.x === 0 && step.y === 0) continue;
      const target = { x: enemy.x + step.x, y: enemy.y + step.y };
      if (!isWalkable(this.dungeon.tiles, target)) continue;
      if (target.x === this.player.x && target.y === this.player.y) continue;
      if (this.enemies.some((candidate) => candidate.id !== enemy.id && candidate.x === target.x && candidate.y === target.y)) continue;
      if (this.chests.some((chest) => chest.x === target.x && chest.y === target.y)) continue;
      return target;
    }

    return undefined;
  }

  private openChest(chest: Chest): void {
    chest.sprite?.destroy();
    this.chests = this.chests.filter((candidate) => candidate.id !== chest.id);
    this.playSound('open', 0.38);
    const tier = chest.loot.type === 'weapon' || chest.loot.type === 'armor'
      ? `${equipmentTierLabel(getEquipmentTier(chest.loot))} `
      : '';
    this.pushLog(`打开旧木箱：${tier}${chest.loot.name}。`);
    this.addItem(chest.loot);
  }

  private openGildingAltar(): void {
    const options: GildingOption[] = [];
    if (canGildEquipment(this.weapon)) {
      options.push({
        targetId: 'equipped-weapon',
        name: this.weapon.name,
        type: 'weapon',
        power: this.weapon.power,
        source: 'equipped',
      });
    }
    if (canGildEquipment(this.armor)) {
      options.push({
        targetId: 'equipped-armor',
        name: this.armor.name,
        type: 'armor',
        power: this.armor.power,
        source: 'equipped',
      });
    }
    for (const item of this.inventory) {
      if ((item.type === 'weapon' || item.type === 'armor') && canGildEquipment(item)) {
        options.push({
          targetId: item.id,
          name: item.name,
          type: item.type,
          power: item.power,
          source: 'inventory',
        });
      }
    }

    if (options.length === 0) {
      this.pushLog('铭金祭台没有找到可铭刻的装备。');
      this.emitUiState();
      return;
    }

    this.gildingOptions = options;
    this.pushLog('祭火升起，等待一件装备接受铭金。');
    this.emitUiState();
  }

  private loadTownStorage(): void {
    this.vault = parseGildedVault(localStorage.getItem(GILDED_VAULT_KEY));
    this.townLoadout = parseTownLoadout(localStorage.getItem(TOWN_LOADOUT_KEY));

    const legacy = parseGildedLoadout(localStorage.getItem(GILDED_LOADOUT_KEY));
    const migrated = mergeGildedEquipment(this.vault, legacy);
    if (migrated.added.length > 0) {
      this.vault = migrated.vault;
      for (const item of migrated.added) {
        if (item.type === 'weapon' && !this.townLoadout.weaponId) this.townLoadout.weaponId = item.id;
        if (item.type === 'armor' && !this.townLoadout.armorId) this.townLoadout.armorId = item.id;
      }
      this.persistTownStorage();
    }

    if (!this.vault.some((item) => item.id === this.townLoadout.weaponId && item.type === 'weapon')) {
      delete this.townLoadout.weaponId;
    }
    if (!this.vault.some((item) => item.id === this.townLoadout.armorId && item.type === 'armor')) {
      delete this.townLoadout.armorId;
    }
  }

  private persistTownStorage(): void {
    localStorage.setItem(GILDED_VAULT_KEY, JSON.stringify(this.vault));
    localStorage.setItem(TOWN_LOADOUT_KEY, JSON.stringify(this.townLoadout));
  }

  private applyTownLoadout(): void {
    const selectedWeapon = this.vault.find(
      (item) => item.id === this.townLoadout.weaponId && item.type === 'weapon',
    );
    const selectedArmor = this.vault.find(
      (item) => item.id === this.townLoadout.armorId && item.type === 'armor',
    );
    this.weapon = selectedWeapon
      ? {
          name: selectedWeapon.name,
          power: selectedWeapon.power,
          rarity: selectedWeapon.rarity,
          gilded: true,
          vaultId: selectedWeapon.id,
          tier: getEquipmentTier(selectedWeapon),
          affixes: selectedWeapon.affixes?.map((affix) => ({ ...affix })),
          setId: selectedWeapon.setId,
          setName: selectedWeapon.setName,
          setBonus: selectedWeapon.setBonus ? { ...selectedWeapon.setBonus } : undefined,
        }
      : { name: '缺口短剑', power: 2, rarity: 'common', tier: 'common' };
    this.armor = selectedArmor
      ? {
          name: selectedArmor.name,
          power: selectedArmor.power,
          rarity: selectedArmor.rarity,
          gilded: true,
          vaultId: selectedArmor.id,
          tier: getEquipmentTier(selectedArmor),
          affixes: selectedArmor.affixes?.map((affix) => ({ ...affix })),
          setId: selectedArmor.setId,
          setName: selectedArmor.setName,
          setBonus: selectedArmor.setBonus ? { ...selectedArmor.setBonus } : undefined,
        }
      : { name: '旧皮甲', power: 1, rarity: 'common', tier: 'common' };
  }

  private openTownLoadout(): void {
    this.townLoadoutOptions = [
      {
        targetId: 'starter-weapon',
        name: '缺口短剑',
        type: 'weapon',
        power: 2,
        rarity: 'common',
        tier: 'common',
        affixes: [],
        equipped: !this.townLoadout.weaponId,
        starter: true,
      },
      {
        targetId: 'starter-armor',
        name: '旧皮甲',
        type: 'armor',
        power: 1,
        rarity: 'common',
        tier: 'common',
        affixes: [],
        equipped: !this.townLoadout.armorId,
        starter: true,
      },
      ...this.vault.map((item) => ({
        targetId: item.id,
        name: item.name,
        type: item.type,
        power: item.power,
        rarity: item.rarity ?? 'common',
        tier: getEquipmentTier(item),
        affixes: item.affixes?.map((affix) => ({ ...affix })) ?? [],
        setName: item.setName,
        setBonus: item.setBonus ? { ...item.setBonus } : undefined,
        equipped: item.type === 'weapon'
          ? this.townLoadout.weaponId === item.id
          : this.townLoadout.armorId === item.id,
        starter: false,
      })),
    ];
    this.emitUiState();
  }

  private equipTownItem(targetId: string): void {
    if (this.status !== 'town' || !this.townLoadoutOptions?.some((option) => option.targetId === targetId)) return;

    if (targetId === 'starter-weapon') {
      delete this.townLoadout.weaponId;
    } else if (targetId === 'starter-armor') {
      delete this.townLoadout.armorId;
    } else {
      const item = this.vault.find((candidate) => candidate.id === targetId);
      if (!item) return;
      if (item.type === 'weapon') this.townLoadout.weaponId = item.id;
      else this.townLoadout.armorId = item.id;
    }

    this.persistTownStorage();
    this.applyTownLoadout();
    this.openTownLoadout();
    this.pushLog('城镇配装已经更新。');
    this.emitUiState();
  }

  private gildEquipment(targetId: string): void {
    if (!this.gildingOptions?.some((option) => option.targetId === targetId) || !this.altar || this.altar.used) return;

    let gilded: Equipment | undefined;
    let type: 'weapon' | 'armor' | undefined;
    if (targetId === 'equipped-weapon') {
      if (!canGildEquipment(this.weapon)) return;
      this.weapon = { ...this.weapon, gilded: true, tier: 'gold' };
      gilded = { ...this.weapon };
      type = 'weapon';
    } else if (targetId === 'equipped-armor') {
      if (!canGildEquipment(this.armor)) return;
      this.armor = { ...this.armor, gilded: true, tier: 'gold' };
      gilded = { ...this.armor };
      type = 'armor';
    } else {
      const item = this.inventory.find((candidate) => candidate.id === targetId);
      if (item && (item.type === 'weapon' || item.type === 'armor') && canGildEquipment(item)) {
        item.gilded = true;
        item.tier = 'gold';
        gilded = {
          name: item.name,
          power: item.power,
          rarity: item.rarity,
          gilded: true,
          tier: 'gold',
          affixes: item.affixes,
          setId: item.setId,
          setName: item.setName,
          setBonus: item.setBonus,
        };
        type = item.type;
      }
    }

    if (!gilded || !type) return;
    this.pendingGilded.push({ ...gilded, type });
    this.altar.used = true;
    if (this.altar.sprite) {
      this.tweens.killTweensOf(this.altar.sprite);
      this.altar.sprite.stop().setTint(0x756b56).setAlpha(0.55);
    }
    this.gildingOptions = null;
    this.pushLog(`${gilded.name}已完成铭金，必须用逃脱卷轴带回地面。`);
    this.playSound('coins', 0.42);
    this.finishTurn();
  }

  private addItem(item: Item): void {
    if (item.type === 'potion') {
      const existing = this.inventory.find((candidate) => canStackItems(candidate, item));
      if (existing) {
        existing.quantity = itemQuantity(existing) + itemQuantity(item);
        this.pushLog(`${item.name}已叠加，当前共有 ${existing.quantity} 瓶。`);
        return;
      }
    }

    if (this.inventory.length >= INVENTORY_CAPACITY) {
      if (item.type === 'scroll') {
        const abandoned = this.inventory.pop();
        this.inventory.push(item);
        this.pushLog(`为唯一的逃脱卷轴腾出位置，遗下了${abandoned?.name ?? '一件物品'}。`);
        return;
      }
      if ((item.type === 'weapon' || item.type === 'armor') && isCarryableEquipment(item)) {
        let replaceIndex = -1;
        for (let index = this.inventory.length - 1; index >= 0; index -= 1) {
          const candidate = this.inventory[index];
          if (
            candidate.type !== 'scroll' &&
            !((candidate.type === 'weapon' || candidate.type === 'armor') && isCarryableEquipment(candidate))
          ) {
            replaceIndex = index;
            break;
          }
        }
        const index = replaceIndex >= 0 ? replaceIndex : this.inventory.length - 1;
        const [abandoned] = this.inventory.splice(index, 1, item);
        this.removePendingEquipment(abandoned);
        this.queueCarryableEquipment(item);
        this.pushLog(`为${equipmentTierLabel(getEquipmentTier(item))}腾出位置，遗下了${abandoned.name}。`);
        return;
      }
      const salvage = Math.max(2, item.power);
      this.gold += salvage;
      this.pushLog(`行囊已满，将${item.name}拆换成 ${salvage} 枚古币。`);
      return;
    }
    this.inventory.push(item);
    this.queueCarryableEquipment(item);
  }

  private queueCarryableEquipment(item: Item): void {
    if ((item.type !== 'weapon' && item.type !== 'armor') || !isCarryableEquipment(item)) return;
    const id = equipmentStorageId(item.type, item);
    if (this.pendingGilded.some((equipment) => equipmentStorageId(equipment.type, equipment) === id)) return;
    this.pendingGilded.push({
      type: item.type,
      name: item.name,
      power: item.power,
      rarity: item.rarity,
      gilded: true,
      tier: getEquipmentTier(item),
      affixes: item.affixes?.map((affix) => ({ ...affix })),
      setId: item.setId,
      setName: item.setName,
      setBonus: item.setBonus ? { ...item.setBonus } : undefined,
    });
  }

  private requestDiscard(index: number): void {
    const item = this.inventory[index];
    if (!item) return;
    this.discardCandidate = {
      source: 'run',
      index,
      name: item.name,
      type: item.type,
      gilded: Boolean(item.gilded),
      quantity: itemQuantity(item),
    };
    this.emitUiState();
  }

  private removePendingEquipment(item: Item): void {
    if ((item.type !== 'weapon' && item.type !== 'armor') || !item.gilded || item.vaultId) return;
    this.pendingGilded = this.pendingGilded.filter(
      (equipment) => equipment.type !== item.type || !equipmentMatchesItem(equipment, item),
    );
  }

  private requestVaultDiscard(targetId: string): void {
    if (this.status !== 'town' || !this.townLoadoutOptions) return;
    const item = this.vault.find((candidate) => candidate.id === targetId);
    if (!item) return;
    this.discardCandidate = {
      source: 'vault',
      targetId: item.id,
      name: item.name,
      type: item.type,
      gilded: true,
      quantity: 1,
    };
    this.emitUiState();
  }

  private confirmDiscard(): void {
    if (!this.discardCandidate) return;
    const candidate = this.discardCandidate;
    if (candidate.source === 'vault') {
      const result = deleteVaultEquipment(this.vault, this.townLoadout, candidate.targetId);
      this.discardCandidate = null;
      if (!result.deleted) {
        this.emitUiState();
        return;
      }

      this.vault = result.vault;
      this.townLoadout = result.loadout;
      this.persistTownStorage();
      this.applyTownLoadout();
      this.pushLog(`${result.deleted.name}已从城镇仓库永久删除。`);
      this.openTownLoadout();
      return;
    }

    const item = this.inventory[candidate.index];
    if (!item) {
      this.discardCandidate = null;
      this.emitUiState();
      return;
    }

    this.inventory.splice(candidate.index, 1);
    this.removePendingEquipment(item);

    this.discardCandidate = null;
    if (item.type === 'scroll') {
      this.pushLog('逃脱卷轴已被丢弃，后续普通层仍有机会再次发现。');
    } else if (item.gilded) {
      this.pushLog(`${item.name}已被丢弃；若它尚未带出，对应铭金记录也已取消。`);
    } else if (item.type === 'potion' && itemQuantity(item) > 1) {
      this.pushLog(`${item.name} ×${itemQuantity(item)} 已整组丢弃。`);
    } else {
      this.pushLog(`${item.name}已从行囊中丢弃。`);
    }
    this.emitUiState();
  }

  private useItem(index: number): void {
    if (this.status !== 'active') return;
    const item = this.inventory[index];
    if (!item) return;

    if (item.type === 'scroll') {
      this.escapeDungeon();
      return;
    }

    if (item.type === 'potion') {
      const before = this.player.hp;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + item.power);
      const quantity = itemQuantity(item);
      if (quantity > 1) item.quantity = quantity - 1;
      else this.inventory.splice(index, 1);
      this.pushLog(`饮下药剂，恢复 ${this.player.hp - before} 点生命。`);
      this.playSound('equip', 0.35);
    } else if (item.type === 'weapon') {
      const old = this.weapon;
      this.weapon = {
        name: item.name,
        power: item.power,
        rarity: item.rarity,
        gilded: item.gilded,
        vaultId: item.vaultId,
        tier: item.tier,
        affixes: item.affixes?.map((affix) => ({ ...affix })),
        setId: item.setId,
        setName: item.setName,
        setBonus: item.setBonus ? { ...item.setBonus } : undefined,
      };
      this.inventory.splice(index, 1);
      this.inventory.push(this.equipmentAsItem('weapon', old));
      this.pushLog(`换上${item.name}，攻击提升至 ${this.totalAttack}。`);
      this.playSound('equip', 0.35);
    } else {
      const old = this.armor;
      this.armor = {
        name: item.name,
        power: item.power,
        rarity: item.rarity,
        gilded: item.gilded,
        vaultId: item.vaultId,
        tier: item.tier,
        affixes: item.affixes?.map((affix) => ({ ...affix })),
        setId: item.setId,
        setName: item.setName,
        setBonus: item.setBonus ? { ...item.setBonus } : undefined,
      };
      this.inventory.splice(index, 1);
      this.inventory.push(this.equipmentAsItem('armor', old));
      this.pushLog(`穿上${item.name}，防御提升至 ${this.totalDefense}。`);
      this.playSound('equip', 0.35);
    }

    this.emitUiState();
  }

  private escapeDungeon(): void {
    if (this.status !== 'active') return;
    const scrollIndex = this.inventory.findIndex((item) => item.type === 'scroll');
    if (scrollIndex < 0) {
      this.pushLog('行囊里没有逃脱卷轴。');
      this.emitUiState();
      return;
    }

    this.inventory.splice(scrollIndex, 1);
    const carried = this.saveGildedEquipment();
    this.unlockRegionAtFloor(this.floor);
    const carriedMessage = carried.length > 0
      ? `，以及铭金装备：${carried.map((item) => item.name).join('、')}`
      : '';
    this.completeReturn(`你带回 ${this.gold} 枚古币${carriedMessage}。`, carried.length > 0);
  }

  private saveGildedEquipment(): VaultEquipment[] {
    if (this.pendingGilded.length === 0) return [];
    const stored = parseGildedVault(localStorage.getItem(GILDED_VAULT_KEY));
    const merged = mergePendingGildedEquipment(stored, this.pendingGilded);
    this.vault = merged.vault;
    localStorage.setItem(GILDED_VAULT_KEY, JSON.stringify(this.vault));
    const persisted = parseGildedVault(localStorage.getItem(GILDED_VAULT_KEY));
    return merged.carried.filter((carried) => persisted.some((item) => item.id === carried.id));
  }

  private returnToTown(): void {
    if (this.status !== 'active' || !this.bossStage || !this.bossDefeated) return;
    this.unlockRegionAtFloor(this.floor);
    this.completeReturn(`守层远征完成，你安全带回 ${this.gold} 枚古币。`);
  }

  private completeReturn(message: string, showTownLoadout = false): void {
    this.bankedGold += this.gold;
    localStorage.setItem('abyss-banked-gold', String(this.bankedGold));
    this.playSound('open', 0.5);
    this.enterTown(message);
    if (showTownLoadout) this.openTownLoadout();
  }

  private createLoot(): Item {
    const roll = this.random.next();
    if (roll < 0.45) return this.createItem('potion');
    if (roll < 0.73) return this.createItem('weapon');
    return this.createItem('armor');
  }

  private createChestLoot(): Item {
    if (shouldDropDarkGoldFromChest(this.random.next())) {
      const type = this.random.next() < 0.5 ? 'weapon' : 'armor';
      return this.createItem(type, 'rare', 'dark-gold');
    }
    return this.createLoot();
  }

  private createItem(
    type: ItemType,
    forcedRarity?: Rarity,
    tier: EquipmentTier = 'common',
  ): Item {
    const rarityRoll = this.random.next() + Math.min(this.floor * 0.025, 0.2);
    const rolledRarity: Rarity = rarityRoll > 0.88 ? 'rare' : rarityRoll > 0.58 ? 'uncommon' : 'common';
    const rarity = forcedRarity ?? rolledRarity;
    const rarityPower = rarity === 'rare' ? 3 : rarity === 'uncommon' ? 1 : 0;
    const id = `item-${this.floor}-${this.itemSerial++}`;

    if (type === 'scroll') {
      return { id, type, name: '逃脱卷轴', description: '带着本次古币返回地面', power: 0, rarity: 'rare' };
    }
    if (type === 'potion') {
      const power = 7 + this.floor * 2 + rarityPower;
      return { id, type, name: rarity === 'rare' ? '赤红秘药' : '止血药剂', description: `恢复 ${power} 点生命`, power, rarity };
    }

    const power = 2 + Math.ceil(this.floor * 0.8) + rarityPower;
    const affixes = tier === 'dark-gold' || tier === 'purple' ? [this.createEquipmentAffix()] : [];
    if (tier === 'purple') {
      const set = PURPLE_SETS[this.random.integer(0, PURPLE_SETS.length - 1)];
      return {
        id,
        type,
        name: set.name,
        description: `${type === 'weapon' ? '攻击' : '防御'} +${power}`,
        power,
        rarity,
        gilded: true,
        tier,
        affixes,
        setId: set.id,
        setName: set.name,
        setBonus: { ...set.bonus },
      };
    }

    if (type === 'weapon') {
      const names = tier === 'dark-gold'
        ? ['黯星战刃', '黑曜处刑斧', '暮光钉锤']
        : (rarity === 'rare' ? ['熔火长剑', '守墓人钉锤'] : ['锈蚀手斧', '矿工短镐', '裂纹弯刀']);
      return {
        id,
        type,
        name: names[this.random.integer(0, names.length - 1)],
        description: `攻击 +${power}`,
        power,
        rarity,
        gilded: tier !== 'common',
        tier,
        affixes,
      };
    }

    const names = tier === 'dark-gold'
      ? ['黯金壁垒', '黑曜守卫甲', '暮光重铠']
      : (rarity === 'rare' ? ['深岩板甲', '缄默守卫甲'] : ['补丁锁甲', '硬皮胸甲', '旧卫兵甲']);
    return {
      id,
      type,
      name: names[this.random.integer(0, names.length - 1)],
      description: `防御 +${power}`,
      power,
      rarity,
      gilded: tier !== 'common',
      tier,
      affixes,
    };
  }

  private createEquipmentAffix(): EquipmentAffix {
    const stat = this.random.next() < 0.5 ? 'attack' : 'defense';
    const value = Math.max(1, Math.ceil(this.floor / 10) + this.random.integer(0, 1));
    return {
      stat,
      value,
      label: stat === 'attack' ? '锋锐' : '坚韧',
    };
  }

  private equipmentAsItem(type: 'weapon' | 'armor', equipment: Equipment): Item {
    return {
      id: `item-old-${this.itemSerial++}`,
      type,
      name: equipment.name,
      description: `${type === 'weapon' ? '攻击' : '防御'} +${equipment.power}`,
      power: equipment.power,
      rarity: equipment.rarity ?? 'common',
      gilded: equipment.gilded,
      vaultId: equipment.vaultId,
      tier: getEquipmentTier(equipment),
      affixes: equipment.affixes?.map((affix) => ({ ...affix })),
      setId: equipment.setId,
      setName: equipment.setName,
      setBonus: equipment.setBonus ? { ...equipment.setBonus } : undefined,
    };
  }

  private updateVision(): void {
    const theme = getRegionTheme(this.floor);
    if (this.bossStage || this.inTown) {
      this.visible = new Set<string>();
      for (let y = 0; y < MAP_HEIGHT; y += 1) {
        for (let x = 0; x < MAP_WIDTH; x += 1) this.visible.add(`${x},${y}`);
      }
    } else {
      this.visible = computeFieldOfView(this.dungeon.tiles, this.player, FOV_RADIUS);
    }
    this.visible.forEach((key) => this.explored.add(key));
    this.fogGraphics.clear().setDepth(20);

    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const key = `${x},${y}`;
        if (this.visible.has(key)) continue;
        const alpha = this.explored.has(key) ? theme.exploredFogAlpha : 0.96;
        this.fogGraphics.fillStyle(theme.fogColor, alpha).fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    for (const enemy of this.enemies) enemy.sprite?.setVisible(this.visible.has(`${enemy.x},${enemy.y}`));
    for (const chest of this.chests) chest.sprite?.setVisible(this.visible.has(`${chest.x},${chest.y}`));
    this.exitSprite?.setVisible(
      this.bossDefeated && this.visible.has(`${this.dungeon.exit.x},${this.dungeon.exit.y}`),
    );
  }

  private tweenToGrid(sprite: Phaser.GameObjects.Sprite, point: Point): void {
    this.tweens.add({
      targets: sprite,
      x: point.x * TILE_SIZE + 16,
      y: point.y * TILE_SIZE + 16,
      duration: 80,
      ease: 'Quad.Out',
    });
  }

  private showDamage(x: number, y: number, amount: number, color: string): void {
    const label = this.add
      .text(x * TILE_SIZE + 16, y * TILE_SIZE + 2, `-${amount}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color,
        stroke: '#080a0b',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({ targets: label, y: label.y - 22, alpha: 0, duration: 520, onComplete: () => label.destroy() });
  }

  private pushLog(message: string): void {
    this.logEntries.unshift(message);
    this.logEntries = this.logEntries.slice(0, 5);
  }

  private playSound(key: string, volume: number): void {
    this.sound.play(key, { volume });
  }

  private shuffle<T>(items: T[]): void {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const other = this.random.integer(0, index);
      [items[index], items[other]] = [items[other], items[index]];
    }
  }

  private distance(a: Point, b: Point): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private emitUiState(): void {
    const boss = this.enemies.find((enemy) => enemy.isBoss);
    const activeSetBonus = resolveSetBonus(this.weapon, this.armor);
    const pendingGilded = this.pendingGilded.map((equipment) => ({ ...equipment }));
    const state: UiState = {
      status: this.status,
      floor: this.floor,
      inTown: this.inTown,
      areaLabel: this.inTown ? '灰炉镇' : (this.bossStage ? `第 ${this.floor} 层守门大殿` : `第 ${this.floor} 层`),
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      attack: this.totalAttack,
      defense: this.totalDefense,
      gold: this.gold,
      bankedGold: this.bankedGold,
      weapon: { ...this.weapon },
      armor: { ...this.armor },
      inventory: this.inventory.map((item) => ({ ...item })),
      inventoryCapacity: INVENTORY_CAPACITY,
      log: [...this.logEntries],
      muted: this.sound.mute,
      isBossFloor: this.bossStage,
      canReturnToTown: this.status === 'active' && this.bossStage && this.bossDefeated,
      gildingOptions: this.gildingOptions?.map((option) => ({ ...option })) ?? null,
      pendingGilded,
      townLoadoutOptions: this.townLoadoutOptions?.map((option) => ({ ...option })) ?? null,
      regionOptions: this.regionOptions?.map((option) => ({ ...option })) ?? null,
      discardCandidate: this.discardCandidate ? { ...this.discardCandidate } : null,
      activeSetBonus,
      boss: boss ? { name: boss.name, hp: boss.hp, maxHp: boss.maxHp } : null,
    };
    window.dispatchEvent(new CustomEvent<UiState>(UI_EVENT, { detail: state }));
  }

  private get totalAttack(): number {
    const setBonus = resolveSetBonus(this.weapon, this.armor)?.affix;
    return this.player.baseAttack +
      this.weapon.power +
      equipmentAffixBonus(this.weapon, 'attack') +
      equipmentAffixBonus(this.armor, 'attack') +
      (setBonus?.stat === 'attack' ? setBonus.value : 0);
  }

  private get totalDefense(): number {
    const setBonus = resolveSetBonus(this.weapon, this.armor)?.affix;
    return this.player.baseDefense +
      this.armor.power +
      equipmentAffixBonus(this.weapon, 'defense') +
      equipmentAffixBonus(this.armor, 'defense') +
      (setBonus?.stat === 'defense' ? setBonus.value : 0);
  }
}
