import Phaser from 'phaser';
import { createIcons, icons } from 'lucide';
import './style.css';
import { GameScene } from './game/GameScene';
import { COMMAND_EVENT, UI_EVENT, type GameCommand, type Item, type UiState } from './game/types';

const getElement = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing UI element: ${id}`);
  return element as T;
};

const floorValue = getElement('floor-value');
const hpValue = getElement('hp-value');
const hpFill = getElement('hp-fill');
const goldValue = getElement('gold-value');
const bankedValue = getElement('banked-value');
const combatValue = getElement('combat-value');
const weaponValue = getElement('weapon-value');
const armorValue = getElement('armor-value');
const bagCount = getElement('bag-count');
const bagGrid = getElement('bag-grid');
const eventLog = getElement<HTMLOListElement>('event-log');
const escapeButton = getElement<HTMLButtonElement>('escape-button');
const muteButton = getElement<HTMLButtonElement>('mute-button');
const restartButton = getElement<HTMLButtonElement>('restart-button');
const startButton = getElement<HTMLButtonElement>('start-button');
const startLabel = getElement('start-label');
const runModal = getElement('run-modal');
const modalKicker = getElement('modal-kicker');
const modalTitle = getElement('modal-title');
const modalCopy = getElement('modal-copy');

function sendCommand(command: GameCommand): void {
  window.dispatchEvent(new CustomEvent<GameCommand>(COMMAND_EVENT, { detail: command }));
}

function iconForItem(item: Item): string {
  const iconsByType: Record<Item['type'], string> = {
    potion: 'flask-conical',
    weapon: 'sword',
    armor: 'shield',
    scroll: 'scroll-text',
  };
  return iconsByType[item.type];
}

function renderInventory(items: Item[]): void {
  bagGrid.replaceChildren();

  for (let index = 0; index < 6; index += 1) {
    const item = items[index];
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = `bag-slot${item ? ` has-item rarity-${item.rarity}` : ''}`;

    if (item) {
      slot.title = `${item.name}：${item.description}`;
      slot.setAttribute('aria-label', `${item.name}，${item.description}`);
      slot.innerHTML = `
        <span class="slot-index">${index + 1}</span>
        <i data-lucide="${iconForItem(item)}" aria-hidden="true"></i>
        <strong>${item.name}</strong>
        <small>${item.description}</small>
      `;
      slot.addEventListener('click', () => sendCommand({ action: 'use-item', index }));
    } else {
      slot.disabled = true;
      slot.setAttribute('aria-label', `空行囊位 ${index + 1}`);
      slot.innerHTML = `<span class="slot-index">${index + 1}</span><i data-lucide="package" aria-hidden="true"></i>`;
    }

    bagGrid.append(slot);
  }
}

function renderModal(state: UiState): void {
  if (state.status === 'active') {
    runModal.classList.remove('is-visible');
    return;
  }

  runModal.classList.add('is-visible');
  if (state.status === 'dead') {
    modalKicker.textContent = `止步 · 第 ${state.floor} 层`;
    modalTitle.textContent = '火把已经熄灭';
    modalCopy.textContent = `${state.gold} 枚古币和本次装备永远留在了洞里。`;
    startLabel.textContent = '再次下洞';
  } else if (state.status === 'escaped') {
    modalKicker.textContent = `归还 · 第 ${state.floor} 层`;
    modalTitle.textContent = '这次你收住了手';
    modalCopy.textContent = `${state.gold} 枚古币已经入库。下一次，洞会更深。`;
    startLabel.textContent = '开始新远征';
  } else {
    modalKicker.textContent = '远征记录 · 001';
    modalTitle.textContent = '准备下洞';
    modalCopy.textContent = '火光之外没有承诺。带回来的，才真正属于你。';
    startLabel.textContent = '进入洞窟';
  }
}

function renderState(state: UiState): void {
  floorValue.textContent = String(state.floor);
  hpValue.textContent = `${state.hp} / ${state.maxHp}`;
  hpFill.style.width = `${Math.max(0, (state.hp / state.maxHp) * 100)}%`;
  hpFill.classList.toggle('is-low', state.hp / state.maxHp <= 0.3);
  goldValue.textContent = String(state.gold);
  bankedValue.textContent = String(state.bankedGold);
  combatValue.textContent = `战力 ${state.attack + state.defense}`;
  weaponValue.textContent = `${state.weapon.name} · +${state.weapon.power}`;
  armorValue.textContent = `${state.armor.name} · +${state.armor.power}`;
  bagCount.textContent = `${state.inventory.length} / 6`;

  renderInventory(state.inventory);
  eventLog.replaceChildren(
    ...state.log.map((entry) => {
      const item = document.createElement('li');
      item.textContent = entry;
      return item;
    }),
  );

  const hasScroll = state.inventory.some((item) => item.type === 'scroll');
  escapeButton.disabled = state.status !== 'active' || !hasScroll;
  muteButton.innerHTML = `<i data-lucide="${state.muted ? 'volume-x' : 'volume-2'}" aria-hidden="true"></i>`;
  muteButton.setAttribute('aria-label', state.muted ? '开启声音' : '关闭声音');
  muteButton.title = state.muted ? '开启声音' : '关闭声音';
  renderModal(state);
  createIcons({ icons });
}

window.addEventListener(UI_EVENT, (event) => {
  renderState((event as CustomEvent<UiState>).detail);
});

startButton.addEventListener('click', () => sendCommand({ action: 'start' }));
restartButton.addEventListener('click', () => sendCommand({ action: 'start' }));
muteButton.addEventListener('click', () => sendCommand({ action: 'mute' }));
escapeButton.addEventListener('click', () => sendCommand({ action: 'escape' }));

document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => {
  button.addEventListener('click', () => {
    const direction = button.dataset.move as Extract<GameCommand, { action: 'move' }>['direction'];
    sendCommand({ action: 'move', direction });
  });
});

createIcons({ icons });

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-stage',
  width: 896,
  height: 640,
  backgroundColor: '#0d1012',
  pixelArt: true,
  antialias: false,
  render: {
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});

window.addEventListener('beforeunload', () => game.destroy(true));
