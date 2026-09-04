import Phaser from 'phaser';
import {
  collectWalkableTiles,
  createRandom,
  generateBossArena,
  generateDungeon,
  generateTownMap,
  findPath,
  findPathToAdjacent,
  isWalkable,
  MAP_HEIGHT,
  MAP_WIDTH,
  type Dungeon,
  type Point,
  type RandomSource,
} from './dungeon';
import { computeFieldOfView } from './fov';
import {
  ELITE_AFFIXES,
  getEliteBulwarkShield,
  getEliteFrenzyAttack,
  getEliteLifeSteal,
  getEliteStats,
  rollEliteAffix,
  shouldSpawnHeroicElite,
} from './elite';
import {
  FOURTH_BOSS_BURN_TURNS,
  FOURTH_BOSS_CONTROL_TURNS,
  FOURTH_BOSS_HEAL_TURNS,
  FIFTH_BOSS_SUMMON_CAP,
  getBossChargeReinforcement,
  getFourthBossBurnDamage,
  getFourthBossHealingAmount,
  getBossSkill,
  getBossSkillById,
  getBossSkillDamage,
  getBossSkillForPhase,
  getBossSkillTiles,
  resolveShieldDamage,
  shouldEnterBossSecondPhase,
  shouldStartFourthBossHealing,
  getThirdBossReleaseSummonCount,
  THIRD_BOSS_SUMMON_CAP,
  type BossSkillDefinition,
} from './bossSkills';
import { createBestiaryRegions } from './bestiary';
import {
  getAdventureDifficultyFloor,
  getHeroicDifficultyFloor,
  HEROIC_REGION_COUNT,
  HEROIC_UNLOCK_KEY,
  parseHeroicUnlock,
  shouldUnlockHeroic,
} from './heroic';
import {
  equipmentAffixBonus,
  equipmentStorageId,
  equipmentTierLabel,
  getEnhancementBonus,
  getEnhancementCost,
  getEnhancementGain,
  getEnhancementLevel,
  getEnhancementMaxLevel,
  getEnhancementSuccessChance,
  getEquipmentScore,
  getEquipmentTier,
  isCarryableEquipment,
  isDarkGoldEquipment,
  isPremiumPickupTier,
  resolveSetBonus,
  rollBossRewardTiers,
  rollEnhancementSuccess,
  shouldCriticalHit,
  shouldDropDarkGoldFromChest,
} from './equipment';
import { canStackItems, itemQuantity } from './inventory';
import { rollMonsterLootType, rollRegularLootType } from './loot';
import {
  createMerchantOffers,
  getRegionMaterial,
  MATERIAL_VAULT_KEY,
  mergeMaterials,
  parseMaterialVault,
  rollJarEquipmentTier,
  spendRegionMaterials,
} from './materials';
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
import {
  advanceStage,
  getBossStats,
  getChestCount,
  getEnemyAttackDamage,
  getEnemyCount,
  getEnemyStats,
} from './progression';
import { getRegionTheme } from './themes';
import {
  PLAYER_SKILLS,
  createPlayerSkillCooldowns,
  getChargedStrikeDamage,
  getGuardedDamage,
  getShockwaveDamage,
  tickPlayerSkillCooldowns,
  type PlayerSkillCooldowns,
  type PlayerSkillId,
} from './playerSkills';
import {
  getRegion,
  getRegionIndex,
  parseRegionProgress,
  REGION_PROGRESS_KEY,
  unlockRegion,
} from './regions';
import {
  COMMAND_EVENT,
  INVENTORY_CAPACITY,
  LOOT_ANIMATION_EVENT,
  UI_EVENT,
  type AdventureMode,
  type Altar,
  type ArtisanOption,
  type BestiaryRegion,
  type Chest,
  type DiscardCandidate,
  type Enemy,
  type Equipment,
  type EquipmentAffix,
  type EquipmentTier,
  type EnhancementConfirmation,
  type EnhancementResult,
  type GameCommand,
  type GildingOption,
  type Item,
  type ItemType,
  type LootAnimationDetail,
  type MerchantOffer,
  type MerchantReveal,
  type MoveDirection,
  type Rarity,
  type RegionOption,
  type RunStatus,
  type TownLoadoutOption,
  type TownMaterialBalance,
  type UiState,
} from './types';

const TILE_SIZE = 32;
const FOV_RADIUS = 7;
const ASSET_ROOT = `${import.meta.env.BASE_URL}assets`;
const TOWN_CHEST = { x: 8, y: 10 };
const TOWN_MERCHANT = { x: 20, y: 10 };
const TOWN_ARTISAN = { x: 14, y: 14 };
const TOWN_ARCHIVIST = { x: 20, y: 14 };

const PURPLE_SETS: Array<{
  id: string;
  name: string;
  bonus: EquipmentAffix;
}> = [
  { id: 'grave-oath', name: '守墓誓约', bonus: { stat: 'bleed', value: 3, label: '血色誓约' } },
  { id: 'deep-echo', name: '深渊回响', bonus: { stat: 'maxHp', value: 12, label: '深渊血脉' } },
  { id: 'ember-crown', name: '余烬王冠', bonus: { stat: 'crit', value: 20, label: '余烬处决' } },
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

interface BossSummonProfile {
  name: string;
  tint: number;
  templateIndex: 0 | 1 | 2;
  hpRatio: number;
  attackRatio: number;
  defenseRatio: number;
}

type BgmKey = 'bgm-town' | 'bgm-dungeon' | 'bgm-boss';

const BGM_VOLUMES: Record<BgmKey, number> = {
  'bgm-town': 0.13,
  'bgm-dungeon': 0.1,
  'bgm-boss': 0.16,
};

const VOID_SUMMON_PROFILE: BossSummonProfile = {
  name: '虚空侍从',
  tint: 0x9b78e8,
  templateIndex: 1,
  hpRatio: 0.12,
  attackRatio: 0.5,
  defenseRatio: 0.45,
};

const SPORE_SUMMON_PROFILE: BossSummonProfile = {
  name: '蚀孢幼体',
  tint: 0x9edb63,
  templateIndex: 0,
  hpRatio: 0.1,
  attackRatio: 0.45,
  defenseRatio: 0.35,
};

export class GameScene extends Phaser.Scene {
  private status: RunStatus = 'waiting';
  private inTown = false;
  private floor = 1;
  private adventureMode: AdventureMode = 'normal';
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
  private townMerchantSprite?: Phaser.GameObjects.Sprite;
  private townArtisanSprite?: Phaser.GameObjects.Sprite;
  private townArchivistSprite?: Phaser.GameObjects.Sprite;
  private explored = new Set<string>();
  private visible = new Set<string>();
  private bossStage = false;
  private bossDefeated = true;
  private bossExitChoice = false;
  private altarFloors = new Map<number, Set<number>>();
  private gildingOptions: GildingOption[] | null = null;
  private pendingGilded: PendingGildedEquipment[] = [];
  private pendingMaterials: TownMaterialBalance[] = [];
  private vault: VaultEquipment[] = [];
  private townMaterials: TownMaterialBalance[] = [];
  private townLoadout: TownLoadoutSelection = {};
  private townLoadoutOptions: TownLoadoutOption[] | null = null;
  private artisanOptions: ArtisanOption[] | null = null;
  private artisanSelectedId: string | null = null;
  private enhancementConfirmation: EnhancementConfirmation | null = null;
  private enhancementResult: EnhancementResult | null = null;
  private bestiaryRegions: BestiaryRegion[] | null = null;
  private regionOptions: RegionOption[] | null = null;
  private regionMapMode: AdventureMode = 'normal';
  private heroicUnlocked = false;
  private merchantOffers: MerchantOffer[] | null = null;
  private merchantReveal: MerchantReveal | null = null;
  private merchantRevealSequence = 0;
  private discardCandidate: DiscardCandidate | null = null;
  private highestUnlockedRegion = 0;
  private escapeScrollFloor = 1;
  private random: RandomSource = createRandom(Date.now());
  private itemSerial = 0;
  private combatTextSerial = 0;
  private playerControlTurns = 0;
  private playerBurnTurns = 0;
  private playerBurnDamage = 0;
  private playerSkillCooldowns: PlayerSkillCooldowns = createPlayerSkillCooldowns();
  private chargedStrikeReady = false;
  private guardReady = false;

  private mapGroup!: Phaser.GameObjects.Group;
  private objectGroup!: Phaser.GameObjects.Group;
  private actorGroup!: Phaser.GameObjects.Group;
  private fogGraphics!: Phaser.GameObjects.Graphics;
  private pointerHintGraphics!: Phaser.GameObjects.Graphics;
  private autoTargetGraphics!: Phaser.GameObjects.Graphics;
  private bossSkillGraphics!: Phaser.GameObjects.Graphics;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private playerControlEffect?: Phaser.GameObjects.Container;
  private currentBgm?: Phaser.Sound.BaseSound;
  private currentBgmKey?: BgmKey;
  private bgmPaused = false;
  private exitSprite!: Phaser.GameObjects.Sprite;
  private autoMoveTarget?: Point;
  private autoCombatTargetId?: string;
  private autoMoveGeneration = 0;
  private autoMoveHistory: string[] = [];
  private heldMoveKey?: string;
  private heldMoveDelay?: Phaser.Time.TimerEvent;
  private heldMoveRepeat?: Phaser.Time.TimerEvent;

  private readonly commandListener = (event: Event) => {
    this.handleCommand((event as CustomEvent<GameCommand>).detail);
  };
  private readonly blurListener = () => this.stopHeldMovement();
  private readonly resumeBgm = () => {
    if (this.currentBgm && !this.currentBgm.isPlaying && !this.bgmPaused) this.currentBgm.play();
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
    this.load.audio('bgm-town', `${ASSET_ROOT}/music/town-tavern.ogg`);
    this.load.audio('bgm-dungeon', `${ASSET_ROOT}/music/dungeon-spooky.ogg`);
    this.load.audio('bgm-boss', `${ASSET_ROOT}/music/boss-battle.ogg`);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d1012');
    this.cameras.main.setRoundPixels(true);
    this.mapGroup = this.add.group();
    this.objectGroup = this.add.group();
    this.actorGroup = this.add.group();
    this.fogGraphics = this.add.graphics().setDepth(20);
    this.pointerHintGraphics = this.add.graphics().setDepth(19);
    this.autoTargetGraphics = this.add.graphics().setDepth(19);
    this.bossSkillGraphics = this.add.graphics().setDepth(18);
    this.bankedGold = Number.parseInt(localStorage.getItem('abyss-banked-gold') ?? '0', 10) || 0;
    this.heroicUnlocked = parseHeroicUnlock(localStorage.getItem(HEROIC_UNLOCK_KEY));
    this.sound.on(Phaser.Sound.Events.UNLOCKED, this.resumeBgm);

    this.bindKeyboard();
    this.bindPointer();
    window.addEventListener(COMMAND_EVENT, this.commandListener);
    window.addEventListener('blur', this.blurListener);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(COMMAND_EVENT, this.commandListener);
      window.removeEventListener('blur', this.blurListener);
      this.sound.off(Phaser.Sound.Events.UNLOCKED, this.resumeBgm);
      this.currentBgm?.stop();
      this.currentBgm?.destroy();
      this.stopHeldMovement();
    });

    this.enterTown('远征者回到了灰炉镇。');
  }

  private bindKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
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
    keyboard.on('keydown', (event: KeyboardEvent) => {
      const direction = movement[event.code];
      if (direction) {
        event.preventDefault();
        if (!event.repeat && this.canUsePointerControls()) this.startHeldMovement(event.code, direction);
        return;
      }

      if (event.repeat) return;

      if (/^Digit[1-9]$/.test(event.code)) {
        this.handleCommand({ action: 'use-item', index: Number(event.code.slice(-1)) - 1 });
      } else if (event.code === 'Digit0') {
        this.handleCommand({ action: 'use-item', index: 9 });
      } else if (event.code === 'KeyQ') {
        this.handleCommand({ action: 'use-skill', skillId: 'charged-strike' });
      } else if (event.code === 'KeyR') {
        this.handleCommand({ action: 'use-skill', skillId: 'guard' });
      } else if (event.code === 'KeyF') {
        this.handleCommand({ action: 'use-skill', skillId: 'shockwave' });
      } else if (event.code === 'KeyC') {
        this.handleCommand({ action: 'use-skill', skillId: 'cleanse' });
      } else if (event.code === 'KeyE') {
        this.handleCommand({ action: 'escape' });
      } else if (event.code === 'Escape') {
        this.handleCommand({
          action: this.bossExitChoice
            ? 'dismiss-boss-exit-choice'
            : (this.enhancementConfirmation
            ? 'dismiss-enhancement-confirmation'
            : (this.discardCandidate
            ? 'dismiss-discard'
            : (this.merchantOffers
            ? 'dismiss-merchant'
            : (this.artisanOptions
            ? 'dismiss-artisan'
            : (this.bestiaryRegions
            ? 'dismiss-bestiary'
            : (this.regionOptions
            ? 'dismiss-region-map'
            : (this.townLoadoutOptions ? 'dismiss-town-loadout' : 'dismiss-gilding'))))))),
        });
      }
    });
    keyboard.on('keyup', (event: KeyboardEvent) => {
      if (event.code === this.heldMoveKey) this.stopHeldMovement();
    });
  }

  private startHeldMovement(key: string, direction: MoveDirection): void {
    this.stopHeldMovement();
    this.heldMoveKey = key;
    this.handleCommand({ action: 'move', direction });
    this.heldMoveDelay = this.time.delayedCall(240, () => {
      if (this.heldMoveKey !== key || !this.canUsePointerControls()) {
        this.stopHeldMovement();
        return;
      }
      this.handleCommand({ action: 'move', direction });
      this.heldMoveRepeat = this.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => {
          if (this.heldMoveKey !== key || !this.canUsePointerControls()) {
            this.stopHeldMovement();
            return;
          }
          this.handleCommand({ action: 'move', direction });
        },
      });
    });
  }

  private stopHeldMovement(): void {
    this.heldMoveDelay?.remove(false);
    this.heldMoveRepeat?.remove(false);
    this.heldMoveDelay = undefined;
    this.heldMoveRepeat = undefined;
    this.heldMoveKey = undefined;
  }

  private bindPointer(): void {
    this.input.setDefaultCursor('pointer');
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.renderPointerHint(pointer));
    this.input.on('pointerout', () => this.pointerHintGraphics.clear());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0 || !this.canUsePointerControls()) return;
      const target = this.pointerTarget(pointer);
      if (!isWalkable(this.dungeon.tiles, target)) {
        this.cancelAutoMove();
        return;
      }
      const enemy = this.enemyAtPointer(pointer) ?? this.enemies.find((candidate) =>
        candidate.x === target.x && candidate.y === target.y && candidate.sprite?.visible !== false,
      );
      this.startAutoMove(target, enemy?.id);
    });
  }

  private pointerTarget(pointer: Phaser.Input.Pointer): Point {
    return {
      x: Math.floor(pointer.worldX / TILE_SIZE),
      y: Math.floor(pointer.worldY / TILE_SIZE),
    };
  }

  private enemyAtPointer(pointer: Phaser.Input.Pointer): Enemy | undefined {
    return this.enemies.find((enemy) => {
      const sprite = enemy.sprite;
      return Boolean(sprite?.visible && sprite.active && sprite.getBounds().contains(pointer.worldX, pointer.worldY));
    });
  }

  private canUsePointerControls(): boolean {
    if (this.status !== 'town' && this.status !== 'active') return false;
    return !this.discardCandidate &&
      !this.merchantOffers &&
      !this.artisanOptions &&
      !this.bestiaryRegions &&
      !this.regionOptions &&
      !this.bossExitChoice &&
      !this.townLoadoutOptions &&
      !this.gildingOptions;
  }

  private renderPointerHint(pointer: Phaser.Input.Pointer): void {
    this.pointerHintGraphics.clear();
    if (!this.canUsePointerControls()) return;
    const target = this.pointerTarget(pointer);
    if (!isWalkable(this.dungeon.tiles, target)) return;
    const enemy = Boolean(this.enemyAtPointer(pointer)) || this.enemies.some((candidate) =>
      candidate.x === target.x && candidate.y === target.y && candidate.sprite?.visible !== false,
    );
    this.pointerHintGraphics
      .lineStyle(2, enemy ? 0xe45f5f : 0xe4c36a, 0.95)
      .strokeRect(target.x * TILE_SIZE + 2, target.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  }

  private startAutoMove(target: Point, combatTargetId?: string): void {
    this.cancelAutoMove();
    if (target.x === this.player.x && target.y === this.player.y && !combatTargetId) return;
    this.autoMoveTarget = { ...target };
    this.autoCombatTargetId = combatTargetId;
    this.autoMoveHistory = [`${this.player.x},${this.player.y}`];
    const generation = this.autoMoveGeneration;
    this.renderAutoTarget(target, Boolean(combatTargetId));
    this.advanceAutoMove(generation);
  }

  private advanceAutoMove(generation: number): void {
    if (generation !== this.autoMoveGeneration) return;
    if (this.consumePlayerControlTurn()) return;
    if (!this.canUsePointerControls() || !this.autoMoveTarget) {
      this.cancelAutoMove();
      return;
    }

    const combatTarget = this.autoCombatTargetId
      ? this.enemies.find((enemy) => enemy.id === this.autoCombatTargetId)
      : undefined;
    if (this.autoCombatTargetId && !combatTarget) {
      this.cancelAutoMove();
      return;
    }
    const destination = combatTarget ? { x: combatTarget.x, y: combatTarget.y } : this.autoMoveTarget;
    if (!combatTarget && destination.x === this.player.x && destination.y === this.player.y) {
      this.cancelAutoMove();
      return;
    }
    if (
      !combatTarget &&
      this.status === 'active' &&
      this.enemies.some((enemy) => this.distance(enemy, this.player) === 1)
    ) {
      this.cancelAutoMove();
      this.pushLog('敌人已经逼近，自动移动已停止。');
      this.emitUiState();
      return;
    }

    if (combatTarget && this.distance(combatTarget, this.player) === 1) {
      this.attackEnemy(combatTarget);
      this.finishTurn();
      if (generation !== this.autoMoveGeneration || !this.canUsePointerControls()) return;
      const survivingTarget = this.enemies.find((enemy) => enemy.id === this.autoCombatTargetId);
      if (!survivingTarget) {
        this.cancelAutoMove();
        return;
      }
      this.renderAutoTarget(survivingTarget, true);
      this.time.delayedCall(220, () => this.advanceAutoMove(generation));
      return;
    }

    const blocked = new Set(
      this.enemies
        .map((enemy) => `${enemy.x},${enemy.y}`),
    );
    if (this.status === 'town') {
      for (const point of [TOWN_CHEST, TOWN_MERCHANT, TOWN_ARTISAN, TOWN_ARCHIVIST, this.dungeon.exit]) {
        if (point.x !== destination.x || point.y !== destination.y) blocked.add(`${point.x},${point.y}`);
      }
    }
    const path = combatTarget
      ? findPathToAdjacent(this.dungeon.tiles, this.player, destination, blocked)
      : findPath(this.dungeon.tiles, this.player, destination, blocked);
    const next = path[0];
    if (!next) {
      this.cancelAutoMove();
      return;
    }

    if (this.enemies.some((enemy) => enemy.x === next.x && enemy.y === next.y)) {
      this.cancelAutoMove();
      return;
    }
    const step = { x: next.x - this.player.x, y: next.y - this.player.y };
    if (this.status === 'town') this.attemptTownMove(step);
    else this.attemptMove(step);
    if (generation !== this.autoMoveGeneration) return;
    if (!this.canUsePointerControls()) {
      this.cancelAutoMove();
      return;
    }

    const positionKey = `${this.player.x},${this.player.y}`;
    if (this.autoMoveHistory.includes(positionKey)) {
      this.cancelAutoMove();
      if (this.status === 'active') {
        this.pushLog('路线受到怪物干扰，自动移动已停止。');
        this.emitUiState();
      }
      return;
    }
    this.autoMoveHistory.push(positionKey);
    this.autoMoveHistory = this.autoMoveHistory.slice(-8);

    const nextCombatTarget = this.autoCombatTargetId
      ? this.enemies.find((enemy) => enemy.id === this.autoCombatTargetId)
      : undefined;
    if (this.autoCombatTargetId && !nextCombatTarget) {
      this.cancelAutoMove();
      return;
    }
    const nextDestination = nextCombatTarget
      ? { x: nextCombatTarget.x, y: nextCombatTarget.y }
      : destination;
    this.renderAutoTarget(nextDestination, Boolean(nextCombatTarget));
    this.time.delayedCall(140, () => this.advanceAutoMove(generation));
  }

  private renderAutoTarget(target: Point, combat: boolean): void {
    this.autoTargetGraphics
      .clear()
      .lineStyle(3, combat ? 0xff6660 : 0xf0cf73, 1)
      .strokeRect(target.x * TILE_SIZE + 4, target.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  }

  private cancelAutoMove(): void {
    this.autoMoveGeneration += 1;
    this.autoMoveTarget = undefined;
    this.autoCombatTargetId = undefined;
    this.autoMoveHistory = [];
    this.pointerHintGraphics?.clear();
    this.autoTargetGraphics?.clear();
  }

  private handleCommand(command: GameCommand): void {
    if (command.action !== 'mute' && command.action !== 'dismiss-merchant-reveal') {
      this.cancelAutoMove();
    }
    if (command.action === 'start') {
      this.enterTown('整备之后，再从矿门出发。');
      return;
    }
    if (command.action === 'enter-town') {
      if (this.status === 'active' && this.bossStage && !this.bossDefeated) {
        this.pushLog('守层者封锁了大殿，击败 Boss 前无法放弃远征。');
        this.emitUiState();
        return;
      }
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
    if (command.action === 'dismiss-enhancement-confirmation') {
      this.enhancementConfirmation = null;
      this.emitUiState();
      return;
    }
    if (command.action === 'confirm-enhancement') {
      const targetId = this.enhancementConfirmation?.targetId;
      this.enhancementConfirmation = null;
      if (targetId) this.performEnhancement(targetId);
      else this.emitUiState();
      return;
    }
    if (this.enhancementConfirmation) return;
    if (command.action === 'dismiss-bestiary') {
      this.bestiaryRegions = null;
      this.emitUiState();
      return;
    }
    if (this.bestiaryRegions) return;
    if (command.action === 'dismiss-artisan') {
      this.artisanOptions = null;
      this.artisanSelectedId = null;
      this.enhancementResult = null;
      this.emitUiState();
      return;
    }
    if (command.action === 'select-artisan-equipment') {
      this.selectArtisanEquipment(command.targetId);
      return;
    }
    if (command.action === 'enhance-equipment') {
      this.requestEnhancement(command.targetId);
      return;
    }
    if (this.artisanOptions) return;
    if (command.action === 'dismiss-merchant') {
      this.merchantOffers = null;
      this.merchantReveal = null;
      this.emitUiState();
      return;
    }
    if (command.action === 'dismiss-merchant-reveal') {
      this.merchantReveal = null;
      this.emitUiState();
      return;
    }
    if (command.action === 'buy-region-jar') {
      this.buyRegionJar(command.regionIndex);
      return;
    }
    if (this.merchantOffers) return;
    if (command.action === 'dismiss-region-map') {
      this.regionOptions = null;
      this.emitUiState();
      return;
    }
    if (command.action === 'select-region-mode') {
      this.selectRegionMapMode(command.mode);
      return;
    }
    if (command.action === 'start-region') {
      this.startRegion(command.regionIndex, command.mode);
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

    if (
      this.playerControlTurns > 0 &&
      (
        command.action === 'move' ||
        command.action === 'use-item' ||
        command.action === 'escape' ||
        command.action === 'return-town' ||
        (command.action === 'use-skill' && command.skillId !== 'cleanse')
      )
    ) {
      this.consumePlayerControlTurn();
      return;
    }
    if (command.action === 'dismiss-boss-exit-choice') {
      this.bossExitChoice = false;
      this.emitUiState();
      return;
    }
    if (command.action === 'continue-after-boss') {
      this.continueAfterBoss();
      return;
    }
    if (command.action === 'return-after-boss') {
      if (this.bossExitChoice) {
        this.bossExitChoice = false;
        this.returnToTown();
      }
      return;
    }
    if (this.bossExitChoice) return;

    if (command.action === 'use-skill') {
      this.usePlayerSkill(command.skillId);
    } else if (command.action === 'move') {
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

  private resetRun(status: RunStatus, startFloor = 1, mode: AdventureMode = 'normal'): void {
    this.status = status;
    this.inTown = false;
    this.adventureMode = mode;
    this.floor = startFloor;
    this.bossStage = false;
    this.bossExitChoice = false;
    this.gold = 0;
    this.player = { x: 0, y: 0, hp: 24, maxHp: 24, baseAttack: 2, baseDefense: 0 };
    this.loadTownStorage();
    this.applyTownLoadout();
    this.player.hp = this.totalMaxHp;
    this.inventory = [];
    this.pendingGilded = [];
    this.pendingMaterials = [];
    this.gildingOptions = null;
    this.townLoadoutOptions = null;
    this.artisanOptions = null;
    this.artisanSelectedId = null;
    this.enhancementConfirmation = null;
    this.enhancementResult = null;
    this.bestiaryRegions = null;
    this.regionOptions = null;
    this.merchantOffers = null;
    this.merchantReveal = null;
    this.discardCandidate = null;
    this.playerControlTurns = 0;
    this.playerBurnTurns = 0;
    this.playerBurnDamage = 0;
    this.playerSkillCooldowns = createPlayerSkillCooldowns();
    this.chargedStrikeReady = false;
    this.guardReady = false;
    this.altarFloors.clear();
    this.logEntries = status === 'active' ? ['铁门在身后合拢。'] : [];
    this.random = createRandom((Date.now() ^ 0xa51b3c7d) >>> 0);
    this.escapeScrollFloor = chooseEscapeScrollFloor(startFloor, () => this.random.next());
    this.buildLevel();
  }

  private enterTown(message: string): void {
    this.status = 'town';
    this.inTown = true;
    this.adventureMode = 'normal';
    this.floor = 1;
    this.bossStage = false;
    this.bossDefeated = true;
    this.bossExitChoice = false;
    this.gold = 0;
    this.player = { x: 0, y: 0, hp: 24, maxHp: 24, baseAttack: 2, baseDefense: 0 };
    this.inventory = [];
    this.pendingGilded = [];
    this.pendingMaterials = [];
    this.gildingOptions = null;
    this.townLoadoutOptions = null;
    this.artisanOptions = null;
    this.artisanSelectedId = null;
    this.enhancementConfirmation = null;
    this.enhancementResult = null;
    this.bestiaryRegions = null;
    this.regionOptions = null;
    this.merchantOffers = null;
    this.merchantReveal = null;
    this.discardCandidate = null;
    this.playerControlTurns = 0;
    this.playerBurnTurns = 0;
    this.playerBurnDamage = 0;
    this.playerSkillCooldowns = createPlayerSkillCooldowns();
    this.chargedStrikeReady = false;
    this.guardReady = false;
    this.altarFloors.clear();
    this.loadTownStorage();
    this.highestUnlockedRegion = parseRegionProgress(localStorage.getItem(REGION_PROGRESS_KEY));
    this.applyTownLoadout();
    this.player.hp = this.totalMaxHp;
    this.logEntries = [message];

    this.clearLevel();
    this.dungeon = generateTownMap();
    this.player.x = this.dungeon.start.x;
    this.player.y = this.dungeon.start.y;
    this.explored = new Set<string>();
    this.renderMap();
    this.renderTownObjects();
    this.updateVision();
    this.switchBgm('bgm-town');
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
    this.switchBgm(this.bossStage ? 'bgm-boss' : 'bgm-dungeon');
    if (this.bossStage) this.pushLog(`第 ${this.floor} 层守层者正在大殿中等待。`);
    this.emitUiState();
  }

  private clearLevel(): void {
    this.cancelAutoMove();
    this.stopHeldMovement();
    this.destroyPlayerControlEffect();
    for (const chest of this.chests) {
      if (chest.effect) this.tweens.killTweensOf(chest.effect.list);
    }
    for (const enemy of this.enemies) {
      this.destroyBossShield(enemy);
      this.destroyBossHealingEffect(enemy);
      this.destroyEliteEffect(enemy);
    }
    this.mapGroup?.clear(true, true);
    this.objectGroup?.clear(true, true);
    this.actorGroup?.clear(true, true);
    this.fogGraphics?.clear();
    this.tweens.killTweensOf(this.bossSkillGraphics);
    this.bossSkillGraphics?.clear().setAlpha(1);
    this.enemies = [];
    this.chests = [];
    this.altar = undefined;
    this.townChestSprite = undefined;
    this.townMerchantSprite = undefined;
    this.townArtisanSprite = undefined;
    this.townArchivistSprite = undefined;
    this.gildingOptions = null;
    this.discardCandidate = null;
    this.bossExitChoice = false;
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

    this.townMerchantSprite = this.add
      .sprite(TOWN_MERCHANT.x * TILE_SIZE + 16, TOWN_MERCHANT.y * TILE_SIZE + 16, 'tiny-dungeon', 85)
      .setScale(2.2)
      .setTint(0xd7ba79)
      .setDepth(6);
    this.objectGroup.add(this.townMerchantSprite);

    this.townArtisanSprite = this.add
      .sprite(TOWN_ARTISAN.x * TILE_SIZE + 16, TOWN_ARTISAN.y * TILE_SIZE + 16, 'tiny-dungeon', 84)
      .setScale(2.2)
      .setTint(0xd68b54)
      .setDepth(6);
    this.objectGroup.add(this.townArtisanSprite);

    this.townArchivistSprite = this.add
      .sprite(TOWN_ARCHIVIST.x * TILE_SIZE + 16, TOWN_ARCHIVIST.y * TILE_SIZE + 16, 'tiny-dungeon', 86)
      .setScale(2.2)
      .setTint(0x8eb9c5)
      .setDepth(6);
    this.objectGroup.add(this.townArchivistSprite);

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
    const merchantLabel = this.add
      .text(TOWN_MERCHANT.x * TILE_SIZE + 16, TOWN_MERCHANT.y * TILE_SIZE + 46, '罐商', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '12px',
        color: '#f0dfb8',
        backgroundColor: '#332919',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(7);
    const artisanLabel = this.add
      .text(TOWN_ARTISAN.x * TILE_SIZE + 16, TOWN_ARTISAN.y * TILE_SIZE + 46, '工匠', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '12px',
        color: '#f1c5a0',
        backgroundColor: '#38251d',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(7);
    const archivistLabel = this.add
      .text(TOWN_ARCHIVIST.x * TILE_SIZE + 16, TOWN_ARCHIVIST.y * TILE_SIZE + 46, '记录官', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '12px',
        color: '#c6e1e8',
        backgroundColor: '#1c2e33',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(7);
    this.objectGroup.addMultiple([gateLabel, chestLabel, merchantLabel, artisanLabel, archivistLabel]);

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
    if (target.x === TOWN_MERCHANT.x && target.y === TOWN_MERCHANT.y) {
      this.openMerchant();
      return;
    }
    if (target.x === TOWN_ARTISAN.x && target.y === TOWN_ARTISAN.y) {
      this.openArtisan();
      return;
    }
    if (target.x === TOWN_ARCHIVIST.x && target.y === TOWN_ARCHIVIST.y) {
      this.openBestiary();
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
    this.heroicUnlocked = parseHeroicUnlock(localStorage.getItem(HEROIC_UNLOCK_KEY));
    this.regionMapMode = 'normal';
    this.refreshRegionOptions();
    this.emitUiState();
  }

  private selectRegionMapMode(mode: AdventureMode): void {
    if (!this.regionOptions || (mode === 'heroic' && !this.heroicUnlocked)) return;
    this.regionMapMode = mode;
    this.refreshRegionOptions();
    this.emitUiState();
  }

  private refreshRegionOptions(): void {
    const count = this.regionMapMode === 'heroic'
      ? HEROIC_REGION_COUNT
      : this.highestUnlockedRegion + 1;
    this.regionOptions = Array.from({ length: count }, (_, index) => {
      const region = getRegion(index);
      return {
        ...region,
        mode: this.regionMapMode,
        difficultyStart: this.regionMapMode === 'heroic'
          ? getHeroicDifficultyFloor(index, 1)
          : region.startFloor,
        difficultyEnd: this.regionMapMode === 'heroic'
          ? getHeroicDifficultyFloor(index, 10)
          : region.endFloor,
      };
    });
  }

  private startRegion(regionIndex: number, mode: AdventureMode): void {
    if (
      this.status !== 'town' ||
      !this.regionOptions?.some((option) => option.index === regionIndex && option.mode === mode) ||
      (mode === 'normal' && regionIndex > this.highestUnlockedRegion) ||
      (mode === 'heroic' && (!this.heroicUnlocked || regionIndex >= HEROIC_REGION_COUNT))
    ) {
      return;
    }
    const region = getRegion(regionIndex);
    this.regionOptions = null;
    this.resetRun('active', region.startFloor, mode);
  }

  private unlockRegionAtFloor(floor: number): void {
    if (this.adventureMode === 'heroic') return;
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
      const stats = getBossStats(this.difficultyFloor);
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
        bossActionCount: 0,
      });
      return;
    }

    const enemyCount = getEnemyCount(this.difficultyFloor);
    for (let index = 0; index < enemyCount && positions.length > 0; index += 1) {
      const position = positions.pop()!;
      const template = theme.enemies[this.random.integer(0, theme.enemies.length - 1)];
      const difficultyProfile = this.adventureMode === 'heroic'
        ? 'heroic'
        : (getRegionIndex(this.floor) === 4 ? 'normal-fifth' : 'standard');
      const stats = getEnemyStats(template, this.difficultyFloor, difficultyProfile);
      this.enemies.push({
        id: `enemy-${this.floor}-${index}`,
        name: template.name,
        x: position.x,
        y: position.y,
        hp: stats.hp,
        maxHp: stats.hp,
        attack: stats.attack,
        defense: stats.defense,
        reward: stats.reward,
        frame: template.frame,
        tint: template.tint,
        scale: template.scale,
        alerted: false,
        isBoss: false,
      });
    }

    if (shouldSpawnHeroicElite(this.adventureMode, this.floor) && positions.length > 0) {
      this.spawnHeroicElite(positions.pop()!);
    }

    const chestCount = getChestCount(this.floor);
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

  private spawnHeroicElite(position: Point): void {
    const theme = getRegionTheme(this.floor);
    const template = theme.enemies[this.random.integer(0, theme.enemies.length - 1)];
    const baseStats = getEnemyStats(template, this.difficultyFloor, 'heroic');
    const stats = getEliteStats(baseStats);
    const affix = rollEliteAffix(this.random.next());
    const elite: Enemy = {
      id: `elite-${this.floor}-${this.itemSerial++}`,
      name: `精英·${template.name}`,
      x: position.x,
      y: position.y,
      hp: stats.hp,
      maxHp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      reward: stats.reward,
      frame: template.frame,
      tint: template.tint,
      scale: template.scale * 1.12,
      alerted: false,
      isBoss: false,
      elite: true,
      eliteAffix: affix.id,
    };
    if (affix.id === 'bulwark') {
      elite.shield = getEliteBulwarkShield(elite.maxHp);
      elite.maxShield = elite.shield;
    }
    this.enemies.push(elite);
    this.pushLog(`本层出现了「${affix.label}」精英怪。`);
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
      if (
        chest.loot &&
        (chest.loot.type === 'weapon' || chest.loot.type === 'armor') &&
        isDarkGoldEquipment(chest.loot)
      ) {
        chest.effect = this.createDarkGoldChestEffect(chest.x, chest.y);
        this.objectGroup.add(chest.effect);
      }
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
      if (enemy.elite) this.createEliteEffect(enemy);
    }

    this.playerSprite = this.add
      .sprite(this.player.x * TILE_SIZE + 16, this.player.y * TILE_SIZE + 16, 'tiny-dungeon', 87)
      .setScale(2)
      .setTint(0xf8efc4)
      .setDepth(8);
    this.actorGroup.add(this.playerSprite);
  }

  private createDarkGoldChestEffect(x: number, y: number): Phaser.GameObjects.Container {
    const wideBeam = this.add
      .rectangle(0, 0, 30, 78, 0xf0a13e, 0.16)
      .setOrigin(0.5, 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    const coreBeam = this.add
      .rectangle(0, 0, 9, 92, 0xffe6a0, 0.34)
      .setOrigin(0.5, 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    const groundGlow = this.add
      .ellipse(0, 0, 48, 20, 0xffb348, 0.24)
      .setBlendMode(Phaser.BlendModes.ADD);
    const sparkle = this.add
      .sprite(0, -70, 'tiny-dungeon', 60)
      .setScale(1.4)
      .setTint(0xffdc82)
      .setAlpha(0.8)
      .setBlendMode(Phaser.BlendModes.ADD);
    const container = this.add
      .container(x * TILE_SIZE + 16, y * TILE_SIZE + 18, [wideBeam, coreBeam, groundGlow, sparkle])
      .setDepth(5);

    this.tweens.add({
      targets: [wideBeam, coreBeam, groundGlow],
      alpha: { from: 0.16, to: 0.48 },
      scaleX: { from: 0.82, to: 1.18 },
      duration: 760,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
    this.tweens.add({
      targets: sparkle,
      y: -84,
      alpha: { from: 0.45, to: 1 },
      duration: 920,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
    return container;
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

    if (
      target.x === this.dungeon.exit.x &&
      target.y === this.dungeon.exit.y &&
      this.bossStage &&
      this.bossDefeated
    ) {
      this.cancelAutoMove();
      this.stopHeldMovement();
      this.bossExitChoice = true;
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
      this.player.hp = Math.min(this.totalMaxHp, this.player.hp + 3);
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

  private finishTurn(excludedSkill?: PlayerSkillId): void {
    this.playerSkillCooldowns = tickPlayerSkillCooldowns(this.playerSkillCooldowns, excludedSkill);
    this.applyPlayerBurnTurn();
    if (this.status === 'dead') return;
    this.updateVision();
    this.runEnemyTurns();
    this.updateVision();
    this.emitUiState();
  }

  private usePlayerSkill(skillId: PlayerSkillId): void {
    const skill = PLAYER_SKILLS.find((candidate) => candidate.id === skillId)!;
    if (this.playerSkillCooldowns[skillId] > 0) {
      this.pushLog(`${skill.name}还需冷却 ${this.playerSkillCooldowns[skillId]} 回合。`);
      this.emitUiState();
      return;
    }

    if (skillId === 'charged-strike') {
      if (this.chargedStrikeReady) return;
      this.chargedStrikeReady = true;
      this.playerSkillCooldowns[skillId] = skill.cooldown;
      this.showStatusText(this.player.x, this.player.y, '蓄力斩就绪', '#f5d278');
      this.pushLog('你开始蓄力，下一次近战攻击将无视部分防御并造成额外伤害。');
      this.playSound('equip', 0.4);
      this.finishTurn(skillId);
      return;
    }

    if (skillId === 'guard') {
      if (this.guardReady) return;
      this.guardReady = true;
      this.playerSkillCooldowns[skillId] = skill.cooldown;
      this.showStatusText(this.player.x, this.player.y, '架盾', '#9fc8df');
      this.playerSprite.setTintFill(0x9fc8df);
      this.time.delayedCall(120, () => this.playerSprite.clearTint());
      this.pushLog('你架起防御，下一次直接伤害减半并抵挡附带控制。');
      this.finishTurn(skillId);
      return;
    }

    if (skillId === 'shockwave') {
      this.useShockwave(skill.cooldown);
      return;
    }

    if (this.playerControlTurns <= 0 && this.playerBurnTurns <= 0) {
      this.pushLog('当前没有可以净化的禁锢或灼烧。');
      this.emitUiState();
      return;
    }
    this.playerControlTurns = 0;
    this.playerBurnTurns = 0;
    this.playerBurnDamage = 0;
    this.destroyPlayerControlEffect();
    this.playerSkillCooldowns[skillId] = skill.cooldown;
    this.showStatusText(this.player.x, this.player.y, '净化', '#a9edcf');
    this.cameras.main.flash(140, 92, 150, 128, false);
    this.pushLog('你净化了身上的禁锢与灼烧。');
    this.finishTurn(skillId);
  }

  private useShockwave(cooldown: number): void {
    const targets = this.enemies.filter((enemy) => this.distance(enemy, this.player) === 1);
    if (targets.length === 0) {
      this.pushLog('周围没有可以被震荡波命中的敌人。');
      this.emitUiState();
      return;
    }

    const wave = this.add
      .circle(this.player.x * TILE_SIZE + 16, this.player.y * TILE_SIZE + 16, 18, 0x78c9dd, 0.12)
      .setStrokeStyle(3, 0xbcefff, 0.92)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(29);
    this.tweens.add({
      targets: wave,
      scaleX: 2.8,
      scaleY: 2.8,
      alpha: 0,
      duration: 420,
      onComplete: () => wave.destroy(),
    });

    for (const enemy of targets) {
      if (!this.enemies.some((candidate) => candidate.id === enemy.id)) continue;
      if (enemy.isBoss && (enemy.bossHealingTurns ?? 0) > 0) {
        this.showStatusText(enemy.x, enemy.y, '无敌', '#ffd078');
        continue;
      }
      const damage = getShockwaveDamage(this.totalAttack, enemy.defense);
      const result = this.applyDamageToEnemy(enemy, damage);
      if (result.absorbed > 0) this.showDamage(enemy.x, enemy.y, result.absorbed, 'shield');
      if (result.healthDamage > 0) this.showDamage(enemy.x, enemy.y, result.healthDamage, 'normal');
      enemy.alerted = true;
      if (enemy.hp <= 0) this.defeatEnemy(enemy);
    }
    this.playerSkillCooldowns.shockwave = cooldown;
    this.playSound('hit', 0.55);
    this.pushLog(`震荡波命中了 ${targets.length} 个目标。`);
    this.finishTurn('shockwave');
  }

  private attackEnemy(enemy: Enemy): void {
    if (enemy.isBoss && (enemy.bossHealingTurns ?? 0) > 0) {
      this.cancelAutoMove();
      this.playSound('hit', 0.25);
      this.showStatusText(enemy.x, enemy.y, '无敌', '#ffd078');
      this.pushLog(`${enemy.name}正在熔火再生，当前攻击无法造成伤害。`);
      return;
    }

    const setBonus = resolveSetBonus(this.weapon, this.armor)?.affix;
    const variance = this.random.integer(-1, 1);
    const critical = setBonus?.stat === 'crit' && shouldCriticalHit(setBonus.value, this.random.next());
    const chargedStrike = this.chargedStrikeReady;
    const baseDamage = Math.max(1, this.totalAttack - enemy.defense + variance);
    const damage = chargedStrike
      ? getChargedStrikeDamage(this.totalAttack, enemy.defense, variance, critical)
      : (critical ? baseDamage * 2 : baseDamage);
    this.chargedStrikeReady = false;
    const result = this.applyDamageToEnemy(enemy, damage);
    this.playSound('hit', 0.42);
    if (result.absorbed > 0) this.showDamage(enemy.x, enemy.y, result.absorbed, 'shield');
    if (result.healthDamage > 0) {
      this.showDamage(enemy.x, enemy.y, result.healthDamage, critical ? 'critical' : 'normal');
    }
    enemy.sprite?.setTintFill(0xf5dfc4);
    this.time.delayedCall(70, () => {
      if (!enemy.sprite?.active) return;
      enemy.sprite.setTint(enemy.tint);
    });

    if (enemy.hp > 0) {
      const shieldMessage = result.absorbed > 0 ? `，护盾吸收 ${result.absorbed} 点` : '';
      const healthMessage = result.healthDamage > 0 ? `，生命受到 ${result.healthDamage} 点伤害` : '';
      this.pushLog(`${chargedStrike ? '蓄力斩！' : ''}${critical ? '暴击！' : ''}你击中${enemy.name}${shieldMessage}${healthMessage}。`);
      if (setBonus?.stat === 'bleed') {
        enemy.bleedDamage = setBonus.value;
        enemy.bleedTurns = 2;
        this.pushLog(`${enemy.name}陷入流血，接下来 2 回合持续受伤。`);
      }
      enemy.alerted = true;
      return;
    }

    this.defeatEnemy(enemy);
  }

  private defeatEnemy(enemy: Enemy): void {
    this.destroyBossShield(enemy);
    this.destroyBossHealingEffect(enemy);
    this.destroyEliteEffect(enemy);
    enemy.sprite?.destroy();
    this.enemies = this.enemies.filter((candidate) => candidate.id !== enemy.id);

    if (enemy.summonedByBoss) {
      this.pushLog(`${enemy.name}消散，没有留下战利品。`);
      return;
    }

    this.gold += enemy.reward;
    this.pushLog(`${enemy.name}倒下，找到 ${enemy.reward} 枚古币。`);
    this.playSound('coins', 0.28);

    if (enemy.isBoss) {
      this.pauseBgm();
      this.tweens.killTweensOf(this.bossSkillGraphics);
      this.bossSkillGraphics.clear().setAlpha(1);
      this.bossDefeated = true;
      const remainingSummons = this.enemies.filter((candidate) => candidate.summonedByBoss);
      for (const summon of remainingSummons) summon.sprite?.destroy();
      this.enemies = this.enemies.filter((candidate) => !candidate.summonedByBoss);
      if (remainingSummons.length > 0) this.pushLog(`${enemy.name}倒下，残存的召唤物随之消散。`);
      if (!this.heroicUnlocked && shouldUnlockHeroic(this.adventureMode, this.floor)) {
        this.heroicUnlocked = true;
        localStorage.setItem(HEROIC_UNLOCK_KEY, '1');
        this.pushLog('第五区域首领已被击败，英雄远征永久解锁。');
      }
      this.dungeon.exit = { x: enemy.x, y: enemy.y };
      this.exitSprite
        .setPosition(enemy.x * TILE_SIZE + 16, enemy.y * TILE_SIZE + 16)
        .setTint(getRegionTheme(this.floor).exitTint)
        .setVisible(true);
      const rewardFloor = this.adventureMode === 'heroic' ? 20 : this.floor;
      const rewardTiers = rollBossRewardTiers(rewardFloor, this.random.next(), this.random.next());
      const rewardTypes = ['weapon', 'armor'] as const;
      for (let index = 0; index < rewardTypes.length; index += 1) {
        const reward = this.createItem(rewardTypes[index], 'rare', rewardTiers[index]);
        this.addItem(reward);
        this.animatePremiumPickup(reward, enemy);
        this.pushLog(`守层者掉落了${equipmentTierLabel(getEquipmentTier(reward))}：${reward.name}。`);
      }
      this.pushLog('守层者倒下，通往下层的楼梯出现了。');
    } else if (enemy.elite) {
      const material = this.createItem('material');
      material.quantity = this.random.integer(3, 5);
      if (this.addItem(material)) this.pushLog(`精英怪留下了${material.name} ×${material.quantity}。`);
    } else {
      const loot = this.createMonsterLoot();
      if (loot) this.addItem(loot);
    }
  }

  private runEnemyTurns(): void {
    for (const enemy of [...this.enemies]) {
      if (enemy.isBoss && (enemy.bossHealingTurns ?? 0) > 0) {
        this.runBossHealingTurn(enemy);
        continue;
      }

      if ((enemy.bleedTurns ?? 0) > 0 && (enemy.bleedDamage ?? 0) > 0) {
        const bleedDamage = enemy.bleedDamage!;
        const result = this.applyDamageToEnemy(enemy, bleedDamage);
        enemy.bleedTurns = Math.max(0, enemy.bleedTurns! - 1);
        if (result.absorbed > 0) this.showDamage(enemy.x, enemy.y, result.absorbed, 'shield');
        if (result.healthDamage > 0) this.showDamage(enemy.x, enemy.y, result.healthDamage, 'bleed');
        const shieldMessage = result.absorbed > 0 ? `，其中 ${result.absorbed} 点被护盾吸收` : '';
        this.pushLog(`${enemy.name}受到 ${result.healthDamage} 点流血伤害${shieldMessage}。`);
        if (enemy.hp <= 0) {
          this.defeatEnemy(enemy);
          if (enemy.isBoss) return;
          continue;
        }
        if ((enemy.bossHealingTurns ?? 0) > 0) continue;
      }

      if (enemy.isBoss && enemy.bossSkillId) {
        if ((enemy.bossSkillTurnsRemaining ?? 1) > 1) {
          enemy.bossSkillTurnsRemaining = (enemy.bossSkillTurnsRemaining ?? 1) - 1;
          this.pushLog(`${enemy.name}继续蓄力「${getBossSkillById(enemy.bossSkillId).name}」，剩余 ${enemy.bossSkillTurnsRemaining} 回合。`);
          continue;
        }
        this.resolveBossSkill(enemy);
        if (this.status === 'dead') return;
        continue;
      }

      const distance = this.distance(enemy, this.player);
      if (distance === 1) {
        if (enemy.isBoss && (enemy.bossActionCount ?? 0) >= 2) {
          this.prepareBossSkill(enemy);
          continue;
        }
        this.enemyAttack(enemy);
        if (enemy.isBoss) enemy.bossActionCount = (enemy.bossActionCount ?? 0) + 1;
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
      if (enemy.shieldEffect) this.tweenToGrid(enemy.shieldEffect, next);
      if (enemy.eliteEffect) this.tweenToGrid(enemy.eliteEffect, next);
    }
  }

  private enemyAttack(enemy: Enemy): void {
    const damage = getEnemyAttackDamage(
      enemy.attack,
      this.totalDefense,
      this.random.integer(0, 1),
      enemy.isBoss,
    );
    const result = this.damagePlayer(
      damage,
      (actualDamage) => `${enemy.name}对你造成 ${actualDamage} 点伤害。`,
      'player',
    );
    if (enemy.eliteAffix === 'vampiric' && enemy.hp > 0) {
      const healing = Math.min(getEliteLifeSteal(result.damage), enemy.maxHp - enemy.hp);
      if (healing > 0) {
        enemy.hp += healing;
        this.showStatusText(enemy.x, enemy.y, `吸血 +${healing}`, '#df83bd');
        this.pushLog(`${enemy.name}吸取生命，回复 ${healing} 点生命。`);
      }
    }
  }

  private damagePlayer(
    damage: number,
    message: string | ((actualDamage: number) => string),
    type: 'player' | 'boss-skill' | 'burn',
    label = '',
  ): { damage: number; guarded: boolean } {
    const guarded = this.guardReady && type !== 'burn';
    const actualDamage = guarded ? getGuardedDamage(damage) : damage;
    if (guarded) {
      this.guardReady = false;
      this.showStatusText(this.player.x, this.player.y, `格挡 ${damage - actualDamage}`, '#9fc8df');
      this.pushLog(`架盾抵消了 ${damage - actualDamage} 点伤害。`);
    }
    this.player.hp -= actualDamage;
    this.pushLog(typeof message === 'function' ? message(actualDamage) : message);
    this.showDamage(this.player.x, this.player.y, actualDamage, type, label);
    const skillHit = type === 'boss-skill';
    this.cameras.main.shake(skillHit ? 180 : 80, skillHit ? 0.006 : 0.0025);
    this.playerSprite.setTintFill(type === 'burn' ? 0xffa04d : 0xff746c);
    this.time.delayedCall(80, () => this.playerSprite.clearTint());

    if (this.player.hp > 0) return { damage: actualDamage, guarded };
    this.player.hp = 0;
    this.status = 'dead';
    this.destroyPlayerControlEffect();
    this.playerSprite.setTint(0x6e7173).setAngle(90);
    this.pushLog('火把熄灭了。本次收获遗落在洞中。');
    this.emitUiState();
    return { damage: actualDamage, guarded };
  }

  private applyFourthBossHitEffects(): void {
    this.playerControlTurns = Math.max(this.playerControlTurns, FOURTH_BOSS_CONTROL_TURNS);
    this.playerBurnTurns = Math.max(this.playerBurnTurns, FOURTH_BOSS_BURN_TURNS);
    this.playerBurnDamage = getFourthBossBurnDamage(this.totalMaxHp);
    this.cancelAutoMove();
    this.stopHeldMovement();
    this.refreshPlayerControlVisual();
    this.showStatusText(this.player.x, this.player.y, `禁锢 ${this.playerControlTurns}`, '#ffb15c');
    this.pushLog(`陨火将你禁锢 ${this.playerControlTurns} 回合，并附加 ${this.playerBurnTurns} 回合灼烧。`);
  }

  private consumePlayerControlTurn(): boolean {
    if (this.status !== 'active' || this.playerControlTurns <= 0) return false;
    this.cancelAutoMove();
    this.stopHeldMovement();
    this.playerControlTurns -= 1;
    this.showStatusText(
      this.player.x,
      this.player.y,
      this.playerControlTurns > 0 ? `禁锢 ${this.playerControlTurns}` : '挣脱禁锢',
      '#ffb15c',
    );
    if (this.playerControlEffect) {
      this.tweens.add({
        targets: this.playerControlEffect,
        angle: this.playerControlEffect.angle + 90,
        scaleX: 1.18,
        scaleY: 1.18,
        duration: 180,
        yoyo: true,
      });
    }
    this.pushLog(
      this.playerControlTurns > 0
        ? `你被陨火禁锢，无法行动，剩余 ${this.playerControlTurns} 回合。`
        : '你挣脱了陨火禁锢。',
    );
    if (this.playerControlTurns === 0) this.fadePlayerControlEffect();
    this.finishTurn();
    return true;
  }

  private applyPlayerBurnTurn(): void {
    if (this.playerBurnTurns <= 0 || this.status !== 'active') return;
    const damage = this.playerBurnDamage;
    this.playerBurnTurns -= 1;
    if (this.playerBurnTurns === 0) this.playerBurnDamage = 0;
    this.damagePlayer(
      damage,
      (actualDamage) => `灼烧造成 ${actualDamage} 点伤害，剩余 ${this.playerBurnTurns} 回合。`,
      'burn',
    );
  }

  private refreshPlayerControlVisual(): void {
    this.destroyPlayerControlEffect();
    const ring = this.add.circle(0, 0, 23, 0xff6b36, 0.12)
      .setStrokeStyle(3, 0xffb15c, 0.95);
    const horizontal = this.add.rectangle(0, 0, 42, 5, 0xff7a3e, 0.7);
    const vertical = this.add.rectangle(0, 0, 5, 42, 0xff7a3e, 0.7);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    horizontal.setBlendMode(Phaser.BlendModes.ADD);
    vertical.setBlendMode(Phaser.BlendModes.ADD);
    const effect = this.add
      .container(this.player.x * TILE_SIZE + 16, this.player.y * TILE_SIZE + 16, [ring, horizontal, vertical])
      .setDepth(25);
    this.playerControlEffect = effect;
    this.actorGroup.add(effect);
    this.tweens.add({
      targets: effect,
      angle: 360,
      alpha: { from: 0.55, to: 1 },
      duration: 720,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
  }

  private fadePlayerControlEffect(): void {
    const effect = this.playerControlEffect;
    if (!effect) return;
    this.playerControlEffect = undefined;
    this.tweens.killTweensOf(effect);
    this.tweens.add({
      targets: effect,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 280,
      onComplete: () => {
        if (effect.active) effect.destroy();
      },
    });
  }

  private destroyPlayerControlEffect(): void {
    if (!this.playerControlEffect) return;
    this.tweens.killTweensOf(this.playerControlEffect);
    this.playerControlEffect.destroy();
    this.playerControlEffect = undefined;
  }

  private prepareBossSkill(enemy: Enemy): void {
    const skill = enemy.bossSecondPhase
      ? getBossSkillForPhase(this.floor, true, this.random.next())
      : getBossSkill(this.floor);
    const target = { x: this.player.x, y: this.player.y };
    const blocked = new Set(this.enemies.map((candidate) => `${candidate.x},${candidate.y}`));
    const dangerTiles = getBossSkillTiles(
      skill,
      target,
      this.dungeon.tiles,
      () => this.random.next(),
      blocked,
    );
    enemy.bossActionCount = 0;
    enemy.bossSkillId = skill.id;
    enemy.bossSkillTurnsRemaining = skill.chargeTurns;
    enemy.bossSkillTarget = target;
    enemy.bossSkillTiles = dangerTiles;
    this.cancelAutoMove();
    this.stopHeldMovement();
    this.reinforceFifthBoss(enemy);
    this.renderBossSkillWarning(skill, dangerTiles);
    this.pushLog(`${enemy.name}开始蓄力「${skill.name}」，${skill.chargeTurns} 回合后释放，离开高亮危险格！`);
  }

  private reinforceFifthBoss(enemy: Enemy): void {
    const activeSummons = this.enemies.filter((candidate) => candidate.summonedByBoss).length;
    const reinforcement = getBossChargeReinforcement(this.floor, enemy.maxHp, activeSummons);
    if (reinforcement.shield <= 0) return;

    enemy.shield = reinforcement.shield;
    enemy.maxShield = reinforcement.shield;
    this.refreshBossShieldVisual(enemy);
    this.pushLog(`${enemy.name}展开 ${reinforcement.shield} 点虚空护盾。`);

    const summoned = this.summonBossMinions(enemy, reinforcement.summonCount, VOID_SUMMON_PROFILE);
    if (summoned > 0) this.pushLog(`${enemy.name}从裂隙中召唤了 ${summoned} 名虚空侍从。`);
    else if (activeSummons >= FIFTH_BOSS_SUMMON_CAP) this.pushLog('虚空侍从已经占满大殿。');
  }

  private summonBossMinions(boss: Enemy, count: number, profile: BossSummonProfile): number {
    if (count <= 0) return 0;
    const occupied = new Set(this.enemies.map((enemy) => `${enemy.x},${enemy.y}`));
    occupied.add(`${this.player.x},${this.player.y}`);
    const candidates = collectWalkableTiles(this.dungeon).filter((point) =>
      !occupied.has(`${point.x},${point.y}`) &&
      this.distance(point, boss) >= 2 &&
      this.distance(point, boss) <= 6 &&
      this.distance(point, this.player) >= 3,
    );
    this.shuffle(candidates);

    const theme = getRegionTheme(this.floor);
    const template = theme.enemies[profile.templateIndex];
    let summoned = 0;
    for (const position of candidates.slice(0, count)) {
      const minion: Enemy = {
        id: `boss-summon-${this.floor}-${this.itemSerial++}`,
        name: profile.name,
        x: position.x,
        y: position.y,
        hp: Math.max(1, Math.round(boss.maxHp * profile.hpRatio)),
        maxHp: Math.max(1, Math.round(boss.maxHp * profile.hpRatio)),
        attack: Math.max(1, Math.round(boss.attack * profile.attackRatio)),
        defense: Math.max(0, Math.round(boss.defense * profile.defenseRatio)),
        reward: 0,
        frame: template.frame,
        tint: profile.tint,
        scale: template.scale,
        alerted: true,
        isBoss: false,
        summonedByBoss: true,
      };
      minion.sprite = this.add
        .sprite(position.x * TILE_SIZE + 16, position.y * TILE_SIZE + 16, 'tiny-dungeon', minion.frame)
        .setScale(minion.scale * 0.35)
        .setTint(minion.tint)
        .setAlpha(0)
        .setDepth(7);
      this.actorGroup.add(minion.sprite);
      this.enemies.push(minion);
      this.tweens.add({
        targets: minion.sprite,
        alpha: 1,
        scaleX: minion.scale,
        scaleY: minion.scale,
        duration: 320,
        ease: 'Back.Out',
      });
      summoned += 1;
    }
    return summoned;
  }

  private applyDamageToEnemy(
    enemy: Enemy,
    damage: number,
  ): { absorbed: number; healthDamage: number } {
    const result = resolveShieldDamage(enemy.shield ?? 0, damage);
    enemy.shield = result.remainingShield;
    enemy.hp -= result.healthDamage;
    this.activateEliteFrenzy(enemy);
    this.activateFourthBossHealing(enemy);
    this.activateFifthBossSecondPhase(enemy);
    if (result.absorbed > 0 && result.remainingShield === 0) {
      this.destroyBossShield(enemy);
      this.pushLog(`${enemy.name}的${enemy.elite ? '坚甲护盾' : '虚空护盾'}破碎了。`);
    }
    return { absorbed: result.absorbed, healthDamage: result.healthDamage };
  }

  private createEliteEffect(enemy: Enemy): void {
    const affix = ELITE_AFFIXES.find((candidate) => candidate.id === enemy.eliteAffix) ?? ELITE_AFFIXES[0];
    const ring = this.add.circle(0, 0, 19, affix.color, 0.08)
      .setStrokeStyle(2, affix.color, 0.92)
      .setBlendMode(Phaser.BlendModes.ADD);
    const label = this.add.text(0, -28, affix.label, {
      fontFamily: 'Microsoft YaHei, sans-serif',
      fontSize: '9px',
      color: `#${affix.color.toString(16).padStart(6, '0')}`,
      backgroundColor: '#101315',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);
    const effect = this.add
      .container(enemy.x * TILE_SIZE + 16, enemy.y * TILE_SIZE + 16, [ring, label])
      .setDepth(8);
    enemy.eliteEffect = effect;
    this.actorGroup.add(effect);
    this.tweens.add({
      targets: ring,
      alpha: { from: 0.35, to: 0.95 },
      scaleX: { from: 0.9, to: 1.18 },
      scaleY: { from: 0.9, to: 1.18 },
      duration: 640,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
  }

  private destroyEliteEffect(enemy: Enemy): void {
    if (!enemy.eliteEffect) return;
    this.tweens.killTweensOf(enemy.eliteEffect.list);
    enemy.eliteEffect.destroy(true);
    enemy.eliteEffect = undefined;
  }

  private activateEliteFrenzy(enemy: Enemy): void {
    if (
      !enemy.elite ||
      enemy.eliteAffix !== 'frenzy' ||
      enemy.eliteEnraged ||
      enemy.hp <= 0 ||
      enemy.hp * 2 > enemy.maxHp
    ) {
      return;
    }
    enemy.eliteEnraged = true;
    enemy.attack = getEliteFrenzyAttack(enemy.attack);
    this.showStatusText(enemy.x, enemy.y, '狂怒', '#f07a64');
    enemy.sprite?.setTintFill(0xff5d4d);
    this.time.delayedCall(130, () => {
      if (enemy.sprite?.active) enemy.sprite.setTint(enemy.tint);
    });
    this.pushLog(`${enemy.name}进入狂怒，攻击提高到 ${enemy.attack}。`);
  }

  private activateFourthBossHealing(enemy: Enemy): void {
    if (
      !enemy.isBoss ||
      !shouldStartFourthBossHealing(
        this.floor,
        enemy.hp,
        enemy.maxHp,
        enemy.bossHealingPhases ?? 0,
      )
    ) {
      return;
    }

    enemy.bossHealingPhases = (enemy.bossHealingPhases ?? 0) + 1;
    enemy.bossHealingTurns = FOURTH_BOSS_HEAL_TURNS;
    enemy.bossHealingJustStarted = true;
    enemy.bossActionCount = 0;
    enemy.bossSkillId = undefined;
    enemy.bossSkillTurnsRemaining = undefined;
    enemy.bossSkillTarget = undefined;
    enemy.bossSkillTiles = undefined;
    enemy.bleedDamage = undefined;
    enemy.bleedTurns = 0;
    this.cancelAutoMove();
    this.stopHeldMovement();
    this.tweens.killTweensOf(this.bossSkillGraphics);
    this.bossSkillGraphics.clear().setAlpha(1);
    this.refreshBossHealingVisual(enemy);
    this.pushLog(`${enemy.name}损失了三分之一生命，发动「熔火再生」并进入无敌状态！`);
  }

  private runBossHealingTurn(enemy: Enemy): void {
    if (enemy.bossHealingJustStarted) {
      enemy.bossHealingJustStarted = false;
      return;
    }

    const rolledHealing = getFourthBossHealingAmount(enemy.maxHp, this.random.next());
    const healing = Math.min(rolledHealing, enemy.maxHp - enemy.hp);
    enemy.hp += healing;
    enemy.bossHealingTurns = Math.max(0, (enemy.bossHealingTurns ?? 0) - 1);
    this.showStatusText(enemy.x, enemy.y, `+${healing}`, '#9be887');
    this.playBossHealingPulse(enemy);
    this.pushLog(`${enemy.name}通过熔火再生回复 ${healing} 点生命，剩余 ${enemy.bossHealingTurns} 回合。`);

    if ((enemy.bossHealingTurns ?? 0) > 0) return;
    this.destroyBossHealingEffect(enemy);
    this.pushLog(`${enemy.name}的熔火再生结束，无敌状态解除。`);
  }

  private refreshBossHealingVisual(enemy: Enemy): void {
    this.destroyBossHealingEffect(enemy);
    const outer = this.add.circle(0, 0, 29, 0xff6d3a, 0.1)
      .setStrokeStyle(3, 0xffb24f, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD);
    const inner = this.add.circle(0, 0, 19, 0x72d87c, 0.16)
      .setStrokeStyle(2, 0xa7f08e, 0.8)
      .setBlendMode(Phaser.BlendModes.ADD);
    const sparks = [0, 1, 2, 3].map((index) => {
      const angle = (Math.PI / 2) * index;
      return this.add.circle(Math.cos(angle) * 25, Math.sin(angle) * 25, 3, 0xffd36c, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD);
    });
    const effect = this.add
      .container(enemy.x * TILE_SIZE + 16, enemy.y * TILE_SIZE + 16, [outer, inner, ...sparks])
      .setDepth(9);
    enemy.healingEffect = effect;
    this.actorGroup.add(effect);
    this.tweens.add({
      targets: effect,
      angle: 360,
      duration: 1400,
      repeat: -1,
    });
    this.tweens.add({
      targets: [outer, inner],
      alpha: { from: 0.35, to: 1 },
      duration: 460,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
  }

  private playBossHealingPulse(enemy: Enemy): void {
    const effect = enemy.healingEffect;
    if (effect) {
      this.tweens.add({
        targets: effect,
        scaleX: 1.22,
        scaleY: 1.22,
        duration: 180,
        ease: 'Sine.Out',
        yoyo: true,
      });
    }
    enemy.sprite?.setTintFill(0x9be887);
    this.time.delayedCall(110, () => {
      if (enemy.sprite?.active) enemy.sprite.setTint(enemy.tint);
    });
  }

  private destroyBossHealingEffect(enemy: Enemy): void {
    if (!enemy.healingEffect) return;
    this.tweens.killTweensOf(enemy.healingEffect);
    this.tweens.killTweensOf(enemy.healingEffect.list);
    enemy.healingEffect.destroy(true);
    enemy.healingEffect = undefined;
  }

  private activateFifthBossSecondPhase(enemy: Enemy): void {
    if (!shouldEnterBossSecondPhase(this.floor, enemy.hp, enemy.maxHp, Boolean(enemy.bossSecondPhase))) return;
    enemy.bossSecondPhase = true;
    enemy.bossActionCount = 2;
    this.cameras.main.flash(220, 72, 45, 108, false);
    if (enemy.sprite) {
      this.tweens.add({
        targets: enemy.sprite,
        scaleX: enemy.scale * 1.2,
        scaleY: enemy.scale * 1.2,
        duration: 180,
        ease: 'Sine.Out',
        yoyo: true,
      });
    }
    this.pushLog(`${enemy.name}跌破半血，虚空力量失控，进入二阶段！`);
  }

  private refreshBossShieldVisual(enemy: Enemy): void {
    this.destroyBossShield(enemy, false);
    const shield = this.add
      .circle(enemy.x * TILE_SIZE + 16, enemy.y * TILE_SIZE + 16, 26, 0x7657c8, 0.14)
      .setStrokeStyle(3, 0xc09cff, 0.92)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(8);
    enemy.shieldEffect = shield;
    this.actorGroup.add(shield);
    this.tweens.add({
      targets: shield,
      alpha: { from: 0.45, to: 0.9 },
      scaleX: { from: 0.94, to: 1.12 },
      scaleY: { from: 0.94, to: 1.12 },
      duration: 520,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
  }

  private destroyBossShield(enemy: Enemy, resetShield = true): void {
    if (enemy.shieldEffect) {
      this.tweens.killTweensOf(enemy.shieldEffect);
      enemy.shieldEffect.destroy();
      enemy.shieldEffect = undefined;
    }
    if (resetShield) {
      enemy.shield = 0;
      enemy.maxShield = 0;
    }
  }

  private resolveBossSkill(enemy: Enemy): void {
    const skill = getBossSkillById(enemy.bossSkillId!);
    const target = enemy.bossSkillTarget ?? { x: this.player.x, y: this.player.y };
    const dangerTiles = enemy.bossSkillTiles ?? [];
    this.tweens.killTweensOf(this.bossSkillGraphics);
    this.bossSkillGraphics.clear().setAlpha(1);
    this.playBossSkillAnimation(skill, target, dangerTiles);
    this.summonThirdBossMinionsOnRelease(enemy);
    const hit = dangerTiles.some((tile) => tile.x === this.player.x && tile.y === this.player.y);
    enemy.bossSkillId = undefined;
    enemy.bossSkillTurnsRemaining = undefined;
    enemy.bossSkillTarget = undefined;
    enemy.bossSkillTiles = undefined;
    if (!hit) {
      this.pushLog(`你避开了「${skill.name}」。`);
      return;
    }
    const damage = getBossSkillDamage(skill, enemy.attack, this.totalDefense);
    const hitResult = this.damagePlayer(
      damage,
      (actualDamage) => `「${skill.name}」命中，造成 ${actualDamage} 点伤害。`,
      'boss-skill',
      skill.name,
    );
    if (this.status !== 'dead' && skill.id === 'meteor' && getRegionIndex(this.floor) === 3) {
      if (hitResult.guarded) this.pushLog('架盾挡住了陨火附带的禁锢与灼烧。');
      else this.applyFourthBossHitEffects();
    }
  }

  private summonThirdBossMinionsOnRelease(enemy: Enemy): void {
    const activeSummons = this.enemies.filter((candidate) => candidate.summonedByBoss).length;
    const summonCount = getThirdBossReleaseSummonCount(this.floor, activeSummons);
    if (summonCount <= 0) {
      if (getRegionIndex(this.floor) === 2 && activeSummons >= THIRD_BOSS_SUMMON_CAP) {
        this.pushLog('蚀孢幼体已经布满守层大殿。');
      }
      return;
    }
    const summoned = this.summonBossMinions(enemy, summonCount, SPORE_SUMMON_PROFILE);
    if (summoned > 0) this.pushLog(`${enemy.name}借孢子蚀雨孵化了 ${summoned} 只蚀孢幼体。`);
  }

  private renderBossSkillWarning(skill: BossSkillDefinition, dangerTiles: Point[]): void {
    this.tweens.killTweensOf(this.bossSkillGraphics);
    this.bossSkillGraphics.clear().setAlpha(1);
    for (const tile of dangerTiles) {
      this.bossSkillGraphics
        .fillStyle(skill.color, 0.26)
        .fillRect(tile.x * TILE_SIZE + 2, tile.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4)
        .lineStyle(2, skill.color, 0.95)
        .strokeRect(tile.x * TILE_SIZE + 3, tile.y * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    }
    this.tweens.add({
      targets: this.bossSkillGraphics,
      alpha: { from: 0.42, to: 1 },
      duration: 360,
      yoyo: true,
      repeat: -1,
    });
  }

  private playBossSkillAnimation(skill: BossSkillDefinition, target: Point, dangerTiles: Point[]): void {
    this.bossSkillGraphics.setAlpha(1);
    for (const tile of dangerTiles) {
      this.bossSkillGraphics.fillStyle(skill.color, 0.58)
        .fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
    this.tweens.add({
      targets: this.bossSkillGraphics,
      alpha: 0,
      duration: 520,
      onComplete: () => this.bossSkillGraphics.clear().setAlpha(1),
    });

    const centerX = target.x * TILE_SIZE + 16;
    const centerY = target.y * TILE_SIZE + 16;
    if (skill.visual === 'lightning') {
      const bolt = this.add.rectangle(centerX, centerY - 70, 10, 170, skill.color, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(29);
      this.tweens.add({ targets: bolt, scaleX: 2.6, alpha: 0, duration: 440, onComplete: () => bolt.destroy() });
      return;
    }
    if (skill.visual === 'fire') {
      for (const [index, tile] of dangerTiles.entries()) {
        const impactX = tile.x * TILE_SIZE + 16;
        const impactY = tile.y * TILE_SIZE + 16;
        const meteor = this.add.circle(
          impactX,
          impactY - 100 - (index % 4) * 18,
          7 + (index % 3),
          skill.color,
          0.96,
        )
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(29);
        this.tweens.add({
          targets: meteor,
          y: impactY,
          scaleX: 1.55,
          scaleY: 1.55,
          delay: (index % 8) * 28,
          duration: 230 + (index % 3) * 25,
          ease: 'Quad.In',
          onComplete: () => {
            const blast = this.add.circle(impactX, impactY, 9, 0xffa252, 0.72)
              .setStrokeStyle(2, 0xffd38a, 0.9)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setDepth(29);
            meteor.destroy();
            this.tweens.add({
              targets: blast,
              scaleX: 2.8,
              scaleY: 2.8,
              alpha: 0,
              duration: 300,
              onComplete: () => blast.destroy(),
            });
          },
        });
      }
      return;
    }
    if (skill.visual === 'quake') {
      const wave = this.add.ellipse(centerX, centerY, 28, 16, skill.color, 0.7)
        .setStrokeStyle(3, 0xffdda0, 0.9)
        .setDepth(29);
      this.tweens.add({ targets: wave, scaleX: 6, scaleY: 3, alpha: 0, duration: 540, onComplete: () => wave.destroy() });
      return;
    }
    if (skill.visual === 'nova') {
      const horizontal = this.add.rectangle(centerX, centerY, 108, 12, skill.color, 0.88)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(29);
      const vertical = this.add.rectangle(centerX, centerY, 12, 108, skill.color, 0.88)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(29);
      this.tweens.add({
        targets: [horizontal, vertical],
        scaleX: 1.5,
        scaleY: 1.5,
        angle: 90,
        alpha: 0,
        duration: 560,
        ease: 'Cubic.Out',
        onComplete: () => {
          horizontal.destroy();
          vertical.destroy();
        },
      });
      return;
    }
    const burst = this.add.rectangle(centerX, centerY, 24, 90, skill.color, 0.78)
      .setAngle(skill.visual === 'void' ? 45 : 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(29);
    this.tweens.add({
      targets: burst,
      scaleX: skill.visual === 'void' ? 3.8 : 2.4,
      scaleY: skill.visual === 'poison' ? 1.8 : 1.2,
      angle: skill.visual === 'void' ? 135 : 16,
      alpha: 0,
      duration: 620,
      onComplete: () => burst.destroy(),
    });
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
    if (chest.effect) {
      this.tweens.killTweensOf(chest.effect.list);
      chest.effect.destroy(true);
    }
    chest.sprite?.destroy();
    this.chests = this.chests.filter((candidate) => candidate.id !== chest.id);
    this.playSound('open', 0.38);
    if (!chest.loot) {
      this.pushLog('打开旧木箱，里面空空如也。');
      return;
    }
    const tier = chest.loot.type === 'weapon' || chest.loot.type === 'armor'
      ? `${equipmentTierLabel(getEquipmentTier(chest.loot))} `
      : '';
    this.pushLog(`打开旧木箱：${tier}${chest.loot.name}。`);
    this.addItem(chest.loot);
    this.animatePremiumPickup(chest.loot, chest);
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
        score: getEquipmentScore('weapon', this.weapon),
      });
    }
    if (canGildEquipment(this.armor)) {
      options.push({
        targetId: 'equipped-armor',
        name: this.armor.name,
        type: 'armor',
        power: this.armor.power,
        source: 'equipped',
        score: getEquipmentScore('armor', this.armor),
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
          score: getEquipmentScore(item.type, item),
        });
      } else if (item.type === 'material' && !item.gilded) {
        options.push({
          targetId: item.id,
          name: item.name,
          type: 'material',
          power: 0,
          source: 'inventory',
          quantity: itemQuantity(item),
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
    this.townMaterials = parseMaterialVault(localStorage.getItem(MATERIAL_VAULT_KEY));

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

  private persistMaterialStorage(): void {
    localStorage.setItem(MATERIAL_VAULT_KEY, JSON.stringify(this.townMaterials));
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
          enhancementLevel: getEnhancementLevel(selectedWeapon),
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
          enhancementLevel: getEnhancementLevel(selectedArmor),
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
        enhancementLevel: 0,
        score: getEquipmentScore('weapon', { name: '缺口短剑', power: 2, tier: 'common' }),
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
        enhancementLevel: 0,
        score: getEquipmentScore('armor', { name: '旧皮甲', power: 1, tier: 'common' }),
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
        enhancementLevel: getEnhancementLevel(item),
        score: getEquipmentScore(item.type, item),
        equipped: item.type === 'weapon'
          ? this.townLoadout.weaponId === item.id
          : this.townLoadout.armorId === item.id,
        starter: false,
      })),
    ];
    this.emitUiState();
  }

  private openBestiary(): void {
    this.highestUnlockedRegion = parseRegionProgress(localStorage.getItem(REGION_PROGRESS_KEY));
    this.heroicUnlocked = parseHeroicUnlock(localStorage.getItem(HEROIC_UNLOCK_KEY));
    this.bestiaryRegions = createBestiaryRegions(this.highestUnlockedRegion);
    this.emitUiState();
  }

  private openArtisan(): void {
    this.artisanSelectedId = null;
    this.enhancementConfirmation = null;
    this.enhancementResult = null;
    this.refreshArtisanOptions();
    this.artisanSelectedId = this.artisanOptions?.[0]?.targetId ?? null;
    this.emitUiState();
  }

  private refreshArtisanOptions(): void {
    const tierPriority: Record<EquipmentTier, number> = {
      common: 0,
      gold: 1,
      'dark-gold': 2,
      purple: 3,
    };
    this.artisanOptions = this.vault.flatMap((item) => {
      const tier = getEquipmentTier(item);
      const maxLevel = getEnhancementMaxLevel(tier);
      if (maxLevel === 0) return [];
      const enhancementLevel = Math.min(getEnhancementLevel(item), maxLevel);
      const nextCost = getEnhancementCost(tier, enhancementLevel + 1);
      const gain = getEnhancementGain(item.type, tier);
      return [{
        targetId: item.id,
        name: item.name,
        type: item.type,
        tier,
        power: item.power,
        enhancementLevel,
        maxLevel,
        nextCost,
        canEnhance: enhancementLevel < maxLevel && this.bankedGold >= nextCost,
        attackPerLevel: gain.attack,
        defensePerLevel: gain.defense,
        maxHpPerLevel: gain.maxHp,
        successChance: getEnhancementSuccessChance(tier, enhancementLevel + 1),
        score: getEquipmentScore(item.type, item),
        equipped: item.type === 'weapon'
          ? this.townLoadout.weaponId === item.id
          : this.townLoadout.armorId === item.id,
      }];
    }).sort((left, right) =>
      Number(right.equipped) - Number(left.equipped) ||
      tierPriority[right.tier] - tierPriority[left.tier] ||
      right.enhancementLevel - left.enhancementLevel ||
      left.name.localeCompare(right.name, 'zh-CN'),
    );
  }

  private selectArtisanEquipment(targetId: string): void {
    if (this.status !== 'town' || !this.artisanOptions?.some((option) => option.targetId === targetId)) return;
    this.artisanSelectedId = targetId;
    this.enhancementResult = null;
    this.emitUiState();
  }

  private requestEnhancement(targetId: string): void {
    if (this.status !== 'town' || !this.artisanOptions?.some((option) => option.targetId === targetId)) return;
    const equipment = this.vault.find((item) => item.id === targetId);
    if (!equipment) return;
    this.artisanSelectedId = targetId;
    const tier = getEquipmentTier(equipment);
    const maxLevel = getEnhancementMaxLevel(tier);
    const level = Math.min(getEnhancementLevel(equipment), maxLevel);
    if (level >= maxLevel) {
      this.pushLog(`${equipment.name}已经达到强化上限。`);
      this.emitUiState();
      return;
    }
    const cost = getEnhancementCost(tier, level + 1);
    const successChance = getEnhancementSuccessChance(tier, level + 1);
    if (this.bankedGold < cost) {
      this.pushLog(`入库古币不足，强化${equipment.name}需要 ${cost} 枚。`);
      this.emitUiState();
      return;
    }

    if (level + 1 > 5) {
      this.enhancementConfirmation = {
        targetId,
        name: equipment.name,
        nextLevel: level + 1,
        cost,
        successChance,
      };
      this.emitUiState();
      return;
    }
    this.performEnhancement(targetId);
  }

  private performEnhancement(targetId: string): void {
    if (this.status !== 'town' || !this.artisanOptions?.some((option) => option.targetId === targetId)) return;
    const equipment = this.vault.find((item) => item.id === targetId);
    if (!equipment) return;
    const tier = getEquipmentTier(equipment);
    const maxLevel = getEnhancementMaxLevel(tier);
    const level = Math.min(getEnhancementLevel(equipment), maxLevel);
    if (level >= maxLevel) return;
    const nextLevel = level + 1;
    const cost = getEnhancementCost(tier, nextLevel);
    const successChance = getEnhancementSuccessChance(tier, nextLevel);
    if (this.bankedGold < cost) {
      this.refreshArtisanOptions();
      this.emitUiState();
      return;
    }

    const previousMaxHp = this.totalMaxHp;
    this.bankedGold -= cost;
    localStorage.setItem('abyss-banked-gold', String(this.bankedGold));
    const success = rollEnhancementSuccess(tier, nextLevel, this.random.next());
    if (success) {
      equipment.enhancementLevel = nextLevel;
      this.persistTownStorage();
      this.applyTownLoadout();
      this.adjustHealthForEquipmentChange(previousMaxHp);
      this.pushLog(`${equipment.name}强化成功，达到 +${nextLevel}。`);
      this.playSound('equip', 0.5);
    } else {
      this.pushLog(`${equipment.name}强化失败，消耗 ${cost} 枚入库古币，装备等级未变化。`);
      this.playSound('hit', 0.34);
    }
    this.refreshArtisanOptions();
    this.enhancementResult = {
      success,
      targetId,
      name: equipment.name,
      level: success ? nextLevel : level,
      message: success
        ? `强化成功，${equipment.name}达到 +${nextLevel}。`
        : `强化失败，成功率 ${successChance}%；装备未损坏、未降级。`,
    };
    this.emitUiState();
  }

  private openMerchant(): void {
    this.highestUnlockedRegion = parseRegionProgress(localStorage.getItem(REGION_PROGRESS_KEY));
    this.townMaterials = parseMaterialVault(localStorage.getItem(MATERIAL_VAULT_KEY));
    this.merchantOffers = createMerchantOffers(this.highestUnlockedRegion, this.townMaterials);
    this.merchantReveal = null;
    this.emitUiState();
  }

  private buyRegionJar(regionIndex: number): void {
    if (
      this.status !== 'town' ||
      this.merchantReveal ||
      !this.merchantOffers?.some((offer) => offer.regionIndex === regionIndex)
    ) {
      return;
    }

    const trade = spendRegionMaterials(this.townMaterials, regionIndex);
    if (!trade.success) {
      const material = getRegionMaterial(regionIndex);
      this.pushLog(`${material.name}不足，地区罐子需要 100 个。`);
      this.emitUiState();
      return;
    }

    this.townMaterials = trade.balances;
    const tier = rollJarEquipmentTier(regionIndex, this.random.next());
    const type = this.random.next() < 0.5 ? 'weapon' : 'armor';
    const region = getRegion(regionIndex);
    const reward = this.createItem(type, 'rare', tier, region.startFloor + 4, region.index);
    const pending: PendingGildedEquipment = {
      type,
      name: reward.name,
      power: reward.power,
      rarity: reward.rarity,
      gilded: true,
      tier,
      affixes: reward.affixes?.map((affix) => ({ ...affix })),
      setId: reward.setId,
      setName: reward.setName,
      setBonus: reward.setBonus ? { ...reward.setBonus } : undefined,
    };
    const merged = mergePendingGildedEquipment(this.vault, [pending]);
    this.vault = merged.vault;
    this.persistTownStorage();
    this.persistMaterialStorage();
    this.merchantOffers = createMerchantOffers(this.highestUnlockedRegion, this.townMaterials);
    this.merchantReveal = {
      sequence: ++this.merchantRevealSequence,
      regionName: region.name,
      name: reward.name,
      type,
      power: reward.power,
      tier,
      score: getEquipmentScore(type, reward),
    };
    this.playSound(tier === 'gold' ? 'open' : 'coins', tier === 'purple' ? 0.62 : 0.5);
    this.pushLog(`打开${region.name}罐子，获得${equipmentTierLabel(tier)}：${reward.name}。`);
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

    const material = this.inventory.find((item) => item.id === targetId && item.type === 'material');
    if (material?.materialRegion !== undefined && !material.gilded) {
      material.gilded = true;
      this.pendingMaterials = mergeMaterials(this.pendingMaterials, [{
        ...getRegionMaterial(material.materialRegion),
        quantity: itemQuantity(material),
      }]);
      this.altar.used = true;
      if (this.altar.sprite) {
        this.tweens.killTweensOf(this.altar.sprite);
        this.altar.sprite.stop().setTint(0x756b56).setAlpha(0.55);
      }
      this.gildingOptions = null;
      this.pushLog(`${material.name} ×${itemQuantity(material)} 已完成铭金，可用卷轴带回城镇。`);
      this.playSound('coins', 0.42);
      this.finishTurn();
      return;
    }

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

  private addItem(item: Item): boolean {
    if (item.type === 'potion' || item.type === 'material') {
      const existing = this.inventory.find((candidate) => canStackItems(candidate, item));
      if (existing) {
        existing.quantity = itemQuantity(existing) + itemQuantity(item);
        const unit = item.type === 'potion' ? '瓶' : '份';
        this.pushLog(`${item.name}已叠加，当前共有 ${existing.quantity} ${unit}。`);
        return true;
      }
    }

    if (this.inventory.length >= INVENTORY_CAPACITY) {
      if (item.type === 'scroll') {
        const abandoned = this.inventory.pop();
        this.inventory.push(item);
        this.pushLog(`为唯一的逃脱卷轴腾出位置，遗下了${abandoned?.name ?? '一件物品'}。`);
        return true;
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
        return true;
      }
      const salvage = Math.max(2, item.power);
      this.gold += salvage;
      this.pushLog(`行囊已满，将${item.name}拆换成 ${salvage} 枚古币。`);
      return false;
    }
    this.inventory.push(item);
    this.queueCarryableEquipment(item);
    return true;
  }

  private animatePremiumPickup(item: Item, origin: Point): void {
    if (item.type !== 'weapon' && item.type !== 'armor') return;
    const tier = getEquipmentTier(item);
    if (!isPremiumPickupTier(tier)) return;
    const detail: LootAnimationDetail = {
      itemId: item.id,
      itemType: item.type,
      name: item.name,
      tier,
      worldX: origin.x * TILE_SIZE + TILE_SIZE / 2,
      worldY: origin.y * TILE_SIZE + TILE_SIZE / 2,
    };
    window.dispatchEvent(new CustomEvent<LootAnimationDetail>(LOOT_ANIMATION_EVENT, { detail }));
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
      enhancementLevel: getEnhancementLevel(item),
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
    if (item.type === 'material' && item.gilded && item.materialRegion !== undefined) {
      const quantity = itemQuantity(item);
      this.pendingMaterials = this.pendingMaterials.flatMap((material) => {
        if (material.regionIndex !== item.materialRegion) return [material];
        const remaining = material.quantity - quantity;
        return remaining > 0 ? [{ ...material, quantity: remaining }] : [];
      });
      return;
    }
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
      this.player.hp = Math.min(this.totalMaxHp, this.player.hp + item.power);
      const quantity = itemQuantity(item);
      if (quantity > 1) item.quantity = quantity - 1;
      else this.inventory.splice(index, 1);
      this.pushLog(`饮下药剂，恢复 ${this.player.hp - before} 点生命。`);
      this.playSound('equip', 0.35);
    } else if (item.type === 'weapon') {
      const previousMaxHp = this.totalMaxHp;
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
        enhancementLevel: getEnhancementLevel(item),
      };
      this.inventory.splice(index, 1);
      this.inventory.push(this.equipmentAsItem('weapon', old));
      this.adjustHealthForEquipmentChange(previousMaxHp);
      this.pushLog(`换上${item.name}，攻击提升至 ${this.totalAttack}。`);
      this.playSound('equip', 0.35);
    } else if (item.type === 'armor') {
      const previousMaxHp = this.totalMaxHp;
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
        enhancementLevel: getEnhancementLevel(item),
      };
      this.inventory.splice(index, 1);
      this.inventory.push(this.equipmentAsItem('armor', old));
      this.adjustHealthForEquipmentChange(previousMaxHp);
      this.pushLog(`穿上${item.name}，防御提升至 ${this.totalDefense}。`);
      this.playSound('equip', 0.35);
    } else {
      return;
    }

    this.emitUiState();
  }

  private escapeDungeon(): void {
    if (this.status !== 'active') return;
    if (this.bossStage && !this.bossDefeated) {
      this.pushLog('守层者封锁了退路，击败 Boss 后才能回城。');
      this.emitUiState();
      return;
    }
    const scrollIndex = this.inventory.findIndex((item) => item.type === 'scroll');
    if (scrollIndex < 0) {
      this.pushLog('行囊里没有逃脱卷轴。');
      this.emitUiState();
      return;
    }

    this.inventory.splice(scrollIndex, 1);
    const carried = this.saveGildedEquipment();
    const carriedMaterials = this.saveGildedMaterials();
    this.unlockRegionAtFloor(this.floor);
    const carriedMessage = carried.length > 0
      ? `，以及铭金装备：${carried.map((item) => item.name).join('、')}`
      : '';
    const materialMessage = carriedMaterials.length > 0
      ? `，材料：${carriedMaterials.map((item) => `${item.name} ×${item.quantity}`).join('、')}`
      : '';
    this.completeReturn(
      `你带回 ${this.gold} 枚古币${carriedMessage}${materialMessage}。`,
      carried.length > 0,
    );
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

  private saveGildedMaterials(): TownMaterialBalance[] {
    if (this.pendingMaterials.length === 0) return [];
    const stored = parseMaterialVault(localStorage.getItem(MATERIAL_VAULT_KEY));
    this.townMaterials = mergeMaterials(stored, this.pendingMaterials);
    this.persistMaterialStorage();
    return this.pendingMaterials.map((material) => ({ ...material }));
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

  private createLoot(): Item | undefined {
    const type = rollRegularLootType(this.random.next());
    return type === 'nothing' ? undefined : this.createItem(type);
  }

  private createMonsterLoot(): Item | undefined {
    const type = rollMonsterLootType(this.random.next());
    return type === 'nothing' ? undefined : this.createItem(type);
  }

  private createChestLoot(): Item | undefined {
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
    sourceFloor = this.difficultyFloor,
    sourceRegionIndex = getRegionIndex(this.floor),
  ): Item {
    const rarityRoll = this.random.next() + Math.min(sourceFloor * 0.025, 0.2);
    const rolledRarity: Rarity = rarityRoll > 0.88 ? 'rare' : rarityRoll > 0.58 ? 'uncommon' : 'common';
    const rarity = forcedRarity ?? rolledRarity;
    const rarityPower = rarity === 'rare' ? 3 : rarity === 'uncommon' ? 1 : 0;
    const id = `item-${sourceFloor}-${this.itemSerial++}`;

    if (type === 'scroll') {
      return { id, type, name: '逃脱卷轴', description: '带着本次古币返回地面', power: 0, rarity: 'rare' };
    }
    if (type === 'potion') {
      const power = 7 + sourceFloor * 2 + rarityPower;
      return { id, type, name: rarity === 'rare' ? '赤红秘药' : '止血药剂', description: `恢复 ${power} 点生命`, power, rarity };
    }

    if (type === 'material') {
      const material = getRegionMaterial(sourceRegionIndex);
      const quantity = this.random.integer(1, 3);
      return {
        id,
        type,
        name: material.name,
        description: `${getRegion(material.regionIndex).name}材料`,
        power: 0,
        rarity: 'common',
        quantity,
        materialRegion: material.regionIndex,
      };
    }

    const power = 2 + Math.ceil(sourceFloor * 0.8) + rarityPower;
    const affixes = tier === 'dark-gold' || tier === 'purple'
      ? [this.createEquipmentAffix(type, tier, sourceFloor)]
      : [];
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

  private createEquipmentAffix(
    type: 'weapon' | 'armor',
    tier: EquipmentTier,
    sourceFloor = this.floor,
  ): EquipmentAffix {
    if (tier === 'dark-gold' && type === 'armor') {
      return {
        stat: 'maxHp',
        value: 6 + Math.ceil(sourceFloor / 5) + this.random.integer(0, 2),
        label: '不朽',
      };
    }
    const stat = this.random.next() < 0.5 ? 'attack' : 'defense';
    const value = Math.max(1, Math.ceil(sourceFloor / 10) + this.random.integer(0, 1));
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
      enhancementLevel: getEnhancementLevel(equipment),
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

    for (const enemy of this.enemies) {
      const visible = this.visible.has(`${enemy.x},${enemy.y}`);
      enemy.sprite?.setVisible(visible);
      enemy.shieldEffect?.setVisible(visible);
      enemy.healingEffect?.setVisible(visible);
      enemy.eliteEffect?.setVisible(visible);
    }
    for (const chest of this.chests) chest.sprite?.setVisible(this.visible.has(`${chest.x},${chest.y}`));
    this.exitSprite?.setVisible(
      this.bossDefeated && this.visible.has(`${this.dungeon.exit.x},${this.dungeon.exit.y}`),
    );
  }

  private tweenToGrid(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc | Phaser.GameObjects.Container,
    point: Point,
  ): void {
    this.tweens.killTweensOf(sprite);
    this.tweens.add({
      targets: sprite,
      x: point.x * TILE_SIZE + 16,
      y: point.y * TILE_SIZE + 16,
      duration: 80,
      ease: 'Quad.Out',
    });
  }

  private showDamage(
    x: number,
    y: number,
    amount: number,
    type: 'normal' | 'critical' | 'bleed' | 'burn' | 'shield' | 'player' | 'boss-skill',
    customLabel = '',
  ): void {
    const styles = {
      normal: { prefix: '', color: '#f6d06f', size: 14, rise: 22, duration: 540, scale: 1 },
      critical: { prefix: '暴击 ', color: '#fff0a1', size: 17, rise: 34, duration: 760, scale: 1.16 },
      bleed: { prefix: '流血 ', color: '#ef6672', size: 13, rise: 28, duration: 680, scale: 1 },
      burn: { prefix: '灼烧 ', color: '#ff9a4f', size: 14, rise: 28, duration: 720, scale: 1.06 },
      shield: { prefix: '护盾 ', color: '#c09cff', size: 14, rise: 26, duration: 680, scale: 1.05 },
      player: { prefix: '', color: '#ff746c', size: 15, rise: 26, duration: 620, scale: 1.08 },
      'boss-skill': { prefix: customLabel ? `${customLabel} ` : '技能 ', color: '#ff8f68', size: 16, rise: 34, duration: 820, scale: 1.12 },
    } as const;
    const style = styles[type];
    const horizontalOffset = ((this.combatTextSerial++ % 3) - 1) * 7;
    const label = this.add
      .text(x * TILE_SIZE + 16 + horizontalOffset, y * TILE_SIZE + 2, `${style.prefix}-${amount}`, {
        fontFamily: 'Bahnschrift, Microsoft YaHei, sans-serif',
        fontSize: `${style.size}px`,
        fontStyle: 'bold',
        color: style.color,
        stroke: '#080a0b',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScale(style.scale)
      .setDepth(30);
    this.tweens.add({
      targets: label,
      y: label.y - style.rise,
      alpha: 0,
      scale: style.scale * 0.92,
      duration: style.duration,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    });
  }

  private continueAfterBoss(): void {
    if (!this.bossExitChoice || this.status !== 'active' || !this.bossStage || !this.bossDefeated) return;
    this.bossExitChoice = false;
    const nextStage = advanceStage(this.floor, true);
    this.floor = nextStage.floor;
    this.bossStage = nextStage.bossStage;
    this.player.hp = Math.min(this.totalMaxHp, this.player.hp + 3);
    this.pushLog(`你离开守层大殿，进入第 ${this.floor} 层。`);
    this.playSound('open', 0.42);
    this.buildLevel();
  }

  private showStatusText(x: number, y: number, message: string, color: string): void {
    const label = this.add
      .text(x * TILE_SIZE + 16, y * TILE_SIZE - 5, message, {
        fontFamily: 'Bahnschrift, Microsoft YaHei, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color,
        stroke: '#080a0b',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(31);
    this.tweens.add({
      targets: label,
      y: label.y - 30,
      alpha: 0,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 760,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    });
  }

  private pushLog(message: string): void {
    this.logEntries.unshift(message);
    this.logEntries = this.logEntries.slice(0, 5);
  }

  private playSound(key: string, volume: number): void {
    this.sound.play(key, { volume });
  }

  private switchBgm(key: BgmKey): void {
    this.bgmPaused = false;
    if (this.currentBgmKey === key) {
      if (this.currentBgm?.isPaused) this.currentBgm.resume();
      else if (this.currentBgm && !this.currentBgm.isPlaying && !this.sound.locked) this.currentBgm.play();
      return;
    }
    this.currentBgm?.stop();
    this.currentBgm?.destroy();
    this.currentBgmKey = key;
    this.currentBgm = this.sound.add(key, {
      loop: true,
      volume: BGM_VOLUMES[key],
    });
    if (!this.sound.locked) this.currentBgm.play();
  }

  private pauseBgm(): void {
    this.bgmPaused = true;
    if (this.currentBgm?.isPlaying) this.currentBgm.pause();
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
      adventureMode: this.adventureMode,
      areaLabel: this.inTown
        ? '灰炉镇'
        : `${this.adventureMode === 'heroic' ? '英雄 · ' : ''}${this.bossStage ? `第 ${this.floor} 层守门大殿` : `第 ${this.floor} 层`}`,
      hp: this.player.hp,
      maxHp: this.totalMaxHp,
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
      artisanOptions: this.artisanOptions?.map((option) => ({ ...option })) ?? null,
      artisanSelectedId: this.artisanSelectedId,
      enhancementConfirmation: this.enhancementConfirmation ? { ...this.enhancementConfirmation } : null,
      enhancementResult: this.enhancementResult ? { ...this.enhancementResult } : null,
      bestiaryRegions: this.bestiaryRegions?.map((region) => ({
        ...region,
        enemies: region.enemies.map((enemy) => ({ ...enemy })),
        boss: { ...region.boss },
      })) ?? null,
      regionOptions: this.regionOptions?.map((option) => ({ ...option })) ?? null,
      regionMapMode: this.regionMapMode,
      heroicUnlocked: this.heroicUnlocked,
      discardCandidate: this.discardCandidate ? { ...this.discardCandidate } : null,
      activeSetBonus,
      pendingMaterials: this.pendingMaterials.map((material) => ({ ...material })),
      townMaterials: this.townMaterials.map((material) => ({ ...material })),
      merchantOffers: this.merchantOffers?.map((offer) => ({ ...offer })) ?? null,
      merchantReveal: this.merchantReveal ? { ...this.merchantReveal } : null,
      playerControlTurns: this.playerControlTurns,
      playerBurnTurns: this.playerBurnTurns,
      playerBurnDamage: this.playerBurnDamage,
      playerSkills: PLAYER_SKILLS.map((skill) => {
        const active = skill.id === 'charged-strike'
          ? this.chargedStrikeReady
          : skill.id === 'guard' && this.guardReady;
        const blocked = this.playerControlTurns > 0 && skill.id !== 'cleanse';
        return {
          ...skill,
          cooldown: this.playerSkillCooldowns[skill.id],
          maxCooldown: skill.cooldown,
          ready: this.status === 'active' && this.playerSkillCooldowns[skill.id] === 0 && !active && !blocked,
          active,
          blocked,
        };
      }),
      bossExitChoice: this.bossExitChoice,
      boss: boss ? {
        name: boss.name,
        hp: boss.hp,
        maxHp: boss.maxHp,
        shield: boss.shield ?? 0,
        maxShield: boss.maxShield ?? 0,
        secondPhase: Boolean(boss.bossSecondPhase),
        healingTurns: boss.bossHealingTurns ?? 0,
        chargingSkill: boss.bossSkillId ? getBossSkillById(boss.bossSkillId).name : undefined,
        chargingTurns: boss.bossSkillId ? boss.bossSkillTurnsRemaining ?? 1 : undefined,
      } : null,
    };
    window.dispatchEvent(new CustomEvent<UiState>(UI_EVENT, { detail: state }));
  }

  private get totalAttack(): number {
    const setBonus = resolveSetBonus(this.weapon, this.armor)?.affix;
    return this.player.baseAttack +
      this.weapon.power +
      getEnhancementBonus('weapon', this.weapon).attack +
      getEnhancementBonus('armor', this.armor).attack +
      equipmentAffixBonus(this.weapon, 'attack') +
      equipmentAffixBonus(this.armor, 'attack') +
      (setBonus?.stat === 'attack' ? setBonus.value : 0);
  }

  private get difficultyFloor(): number {
    return getAdventureDifficultyFloor(this.adventureMode, this.floor);
  }

  private get totalDefense(): number {
    const setBonus = resolveSetBonus(this.weapon, this.armor)?.affix;
    return this.player.baseDefense +
      this.armor.power +
      getEnhancementBonus('weapon', this.weapon).defense +
      getEnhancementBonus('armor', this.armor).defense +
      equipmentAffixBonus(this.weapon, 'defense') +
      equipmentAffixBonus(this.armor, 'defense') +
      (setBonus?.stat === 'defense' ? setBonus.value : 0);
  }

  private get totalMaxHp(): number {
    const setBonus = resolveSetBonus(this.weapon, this.armor)?.affix;
    return this.player.maxHp +
      getEnhancementBonus('weapon', this.weapon).maxHp +
      getEnhancementBonus('armor', this.armor).maxHp +
      equipmentAffixBonus(this.weapon, 'maxHp') +
      equipmentAffixBonus(this.armor, 'maxHp') +
      (setBonus?.stat === 'maxHp' ? setBonus.value : 0);
  }

  private adjustHealthForEquipmentChange(previousMaxHp: number): void {
    const nextMaxHp = this.totalMaxHp;
    this.player.hp = Math.min(nextMaxHp, this.player.hp + Math.max(0, nextMaxHp - previousMaxHp));
  }
}
