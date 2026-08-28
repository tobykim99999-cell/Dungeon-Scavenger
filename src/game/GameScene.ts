import Phaser from 'phaser';
import {
  collectWalkableTiles,
  createRandom,
  generateDungeon,
  isWalkable,
  MAP_HEIGHT,
  MAP_WIDTH,
  type Dungeon,
  type Point,
  type RandomSource,
} from './dungeon';
import { computeFieldOfView } from './fov';
import {
  COMMAND_EVENT,
  UI_EVENT,
  type Chest,
  type Enemy,
  type Equipment,
  type GameCommand,
  type Item,
  type ItemType,
  type MoveDirection,
  type Rarity,
  type RunStatus,
  type UiState,
} from './types';

const TILE_SIZE = 32;
const INVENTORY_LIMIT = 6;
const FOV_RADIUS = 7;
const ASSET_ROOT = `${import.meta.env.BASE_URL}assets`;

const ENEMY_TEMPLATES = [
  { name: '噬石虫', frame: 123, hp: 5, attack: 3, defense: 0, reward: 3 },
  { name: '游荡幽魂', frame: 108, hp: 7, attack: 4, defense: 0, reward: 5 },
  { name: '铁面守卫', frame: 122, hp: 11, attack: 5, defense: 1, reward: 8 },
] as const;

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
  private explored = new Set<string>();
  private visible = new Set<string>();
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

    this.resetRun('waiting');
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

      if (/^Digit[1-6]$/.test(event.code)) {
        this.useItem(Number(event.code.slice(-1)) - 1);
      } else if (event.code === 'KeyE') {
        this.escapeDungeon();
      }
    });
  }

  private handleCommand(command: GameCommand): void {
    if (command.action === 'start') {
      this.resetRun('active');
      return;
    }
    if (command.action === 'mute') {
      this.sound.mute = !this.sound.mute;
      this.emitUiState();
      return;
    }
    if (this.status !== 'active') return;

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
    }
  }

  private resetRun(status: RunStatus): void {
    this.status = status;
    this.floor = 1;
    this.gold = 0;
    this.player = { x: 0, y: 0, hp: 24, maxHp: 24, baseAttack: 2, baseDefense: 0 };
    this.weapon = { name: '缺口短剑', power: 2 };
    this.armor = { name: '旧皮甲', power: 1 };
    this.inventory = [];
    this.logEntries = status === 'active' ? ['铁门在身后合拢。'] : [];
    this.random = createRandom((Date.now() ^ 0xa51b3c7d) >>> 0);
    this.buildLevel();
  }

  private buildLevel(): void {
    this.clearLevel();
    const seed = (Date.now() ^ (this.floor * 0x9e3779b1) ^ Math.floor(this.random.next() * 0xffffffff)) >>> 0;
    this.dungeon = generateDungeon(seed);
    this.player.x = this.dungeon.start.x;
    this.player.y = this.dungeon.start.y;
    this.explored = new Set<string>();

    this.renderMap();
    this.spawnLevelContent();
    this.renderActorsAndObjects();
    this.updateVision();
    this.emitUiState();
  }

  private clearLevel(): void {
    this.mapGroup?.clear(true, true);
    this.objectGroup?.clear(true, true);
    this.actorGroup?.clear(true, true);
    this.fogGraphics?.clear();
    this.enemies = [];
    this.chests = [];
  }

  private renderMap(): void {
    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const walkable = this.dungeon.tiles[y][x] === 1;
        const floorColor = (x + y) % 2 === 0 ? 0x3f4744 : 0x3a423f;
        const background = this.add
          .rectangle(x * TILE_SIZE + 16, y * TILE_SIZE + 16, TILE_SIZE, TILE_SIZE, walkable ? floorColor : 0x171c20)
          .setDepth(0);
        this.mapGroup.add(background);

        if (walkable) {
          const grout = this.add
            .rectangle(x * TILE_SIZE + 16, y * TILE_SIZE + 16, TILE_SIZE - 2, TILE_SIZE - 2)
            .setStrokeStyle(1, 0x343a38, 0.65)
            .setDepth(1);
          this.mapGroup.add(grout);
        } else if (this.hasAdjacentFloor(x, y)) {
          const wallTile = this.add
            .sprite(x * TILE_SIZE + 16, y * TILE_SIZE + 16, 'tiny-dungeon', 28)
            .setScale(2)
            .setTint(0xaebbc0)
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

  private spawnLevelContent(): void {
    const positions = collectWalkableTiles(this.dungeon).filter(
      (point) =>
        this.distance(point, this.dungeon.start) > 4 &&
        !(point.x === this.dungeon.exit.x && point.y === this.dungeon.exit.y),
    );
    this.shuffle(positions);

    const enemyCount = Math.min(5 + this.floor * 2, 18);
    for (let index = 0; index < enemyCount && positions.length > 0; index += 1) {
      const position = positions.pop()!;
      const templateIndex = Math.min(
        ENEMY_TEMPLATES.length - 1,
        Math.floor(this.random.next() * Math.min(ENEMY_TEMPLATES.length, 1 + Math.ceil(this.floor / 2))),
      );
      const template = ENEMY_TEMPLATES[templateIndex];
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
        alerted: false,
      });
    }

    const chestCount = Math.min(3 + Math.floor(this.floor / 2), 5);
    for (let index = 0; index < chestCount && positions.length > 0; index += 1) {
      const position = positions.pop()!;
      this.chests.push({
        id: `chest-${this.floor}-${index}`,
        x: position.x,
        y: position.y,
        loot: index === 0 && !this.inventory.some((item) => item.type === 'scroll') ? this.createItem('scroll') : this.createLoot(),
      });
    }
  }

  private renderActorsAndObjects(): void {
    this.exitSprite = this.add
      .sprite(this.dungeon.exit.x * TILE_SIZE + 16, this.dungeon.exit.y * TILE_SIZE + 16, 'tiny-dungeon', 36)
      .setScale(2)
      .setTint(0xb7d7c2)
      .setDepth(5);
    this.objectGroup.add(this.exitSprite);

    for (const chest of this.chests) {
      chest.sprite = this.add
        .sprite(chest.x * TILE_SIZE + 16, chest.y * TILE_SIZE + 16, 'tiny-dungeon', 72)
        .setScale(2)
        .setTint(0xf0c56b)
        .setDepth(6);
      this.objectGroup.add(chest.sprite);
    }

    for (const enemy of this.enemies) {
      enemy.sprite = this.add
        .sprite(enemy.x * TILE_SIZE + 16, enemy.y * TILE_SIZE + 16, 'tiny-dungeon', enemy.frame)
        .setScale(2)
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

    this.player.x = target.x;
    this.player.y = target.y;
    this.tweenToGrid(this.playerSprite, target);
    this.playSound('step', 0.22);

    if (target.x === this.dungeon.exit.x && target.y === this.dungeon.exit.y) {
      this.floor += 1;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 3);
      this.pushLog(`踏入第 ${this.floor} 层，空气更加沉重。`);
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
    this.time.delayedCall(70, () => enemy.sprite?.clearTint());

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

    if (this.random.next() < 0.24) this.addItem(this.createLoot());
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
    this.pushLog(`打开旧木箱：${chest.loot.name}。`);
    this.addItem(chest.loot);
  }

  private addItem(item: Item): void {
    if (this.inventory.length >= INVENTORY_LIMIT) {
      const salvage = Math.max(2, item.power);
      this.gold += salvage;
      this.pushLog(`行囊已满，将${item.name}拆换成 ${salvage} 枚古币。`);
      return;
    }
    this.inventory.push(item);
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
      this.inventory.splice(index, 1);
      this.pushLog(`饮下药剂，恢复 ${this.player.hp - before} 点生命。`);
      this.playSound('equip', 0.35);
    } else if (item.type === 'weapon') {
      const old = this.weapon;
      this.weapon = { name: item.name, power: item.power };
      this.inventory.splice(index, 1);
      this.inventory.push(this.equipmentAsItem('weapon', old));
      this.pushLog(`换上${item.name}，攻击提升至 ${this.totalAttack}。`);
      this.playSound('equip', 0.35);
    } else {
      const old = this.armor;
      this.armor = { name: item.name, power: item.power };
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
    this.bankedGold += this.gold;
    localStorage.setItem('abyss-banked-gold', String(this.bankedGold));
    this.status = 'escaped';
    this.pushLog(`你带着 ${this.gold} 枚古币回到地面。`);
    this.playSound('open', 0.5);
    this.emitUiState();
  }

  private createLoot(): Item {
    const roll = this.random.next();
    if (roll < 0.38) return this.createItem('potion');
    if (roll < 0.67) return this.createItem('weapon');
    if (roll < 0.9) return this.createItem('armor');
    return this.createItem('scroll');
  }

  private createItem(type: ItemType): Item {
    const rarityRoll = this.random.next() + Math.min(this.floor * 0.025, 0.2);
    const rarity: Rarity = rarityRoll > 0.88 ? 'rare' : rarityRoll > 0.58 ? 'uncommon' : 'common';
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
    if (type === 'weapon') {
      const names = rarity === 'rare' ? ['熔火长剑', '守墓人钉锤'] : ['锈蚀手斧', '矿工短镐', '裂纹弯刀'];
      return { id, type, name: names[this.random.integer(0, names.length - 1)], description: `攻击 +${power}`, power, rarity };
    }

    const names = rarity === 'rare' ? ['深岩板甲', '缄默守卫甲'] : ['补丁锁甲', '硬皮胸甲', '旧卫兵甲'];
    return { id, type, name: names[this.random.integer(0, names.length - 1)], description: `防御 +${power}`, power, rarity };
  }

  private equipmentAsItem(type: 'weapon' | 'armor', equipment: Equipment): Item {
    return {
      id: `item-old-${this.itemSerial++}`,
      type,
      name: equipment.name,
      description: `${type === 'weapon' ? '攻击' : '防御'} +${equipment.power}`,
      power: equipment.power,
      rarity: 'common',
    };
  }

  private updateVision(): void {
    this.visible = computeFieldOfView(this.dungeon.tiles, this.player, FOV_RADIUS);
    this.visible.forEach((key) => this.explored.add(key));
    this.fogGraphics.clear().setDepth(20);

    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const key = `${x},${y}`;
        if (this.visible.has(key)) continue;
        const alpha = this.explored.has(key) ? 0.68 : 0.96;
        this.fogGraphics.fillStyle(0x080a0b, alpha).fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    for (const enemy of this.enemies) enemy.sprite?.setVisible(this.visible.has(`${enemy.x},${enemy.y}`));
    for (const chest of this.chests) chest.sprite?.setVisible(this.visible.has(`${chest.x},${chest.y}`));
    this.exitSprite?.setVisible(this.visible.has(`${this.dungeon.exit.x},${this.dungeon.exit.y}`));
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
    const state: UiState = {
      status: this.status,
      floor: this.floor,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      attack: this.totalAttack,
      defense: this.totalDefense,
      gold: this.gold,
      bankedGold: this.bankedGold,
      weapon: { ...this.weapon },
      armor: { ...this.armor },
      inventory: this.inventory.map((item) => ({ ...item })),
      log: [...this.logEntries],
      muted: this.sound.mute,
    };
    window.dispatchEvent(new CustomEvent<UiState>(UI_EVENT, { detail: state }));
  }

  private get totalAttack(): number {
    return this.player.baseAttack + this.weapon.power;
  }

  private get totalDefense(): number {
    return this.player.baseDefense + this.armor.power;
  }
}
