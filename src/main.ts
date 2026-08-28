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

const areaValue = getElement('area-value');
const bossFloorMarker = getElement('boss-floor-marker');
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
const returnTownButton = getElement<HTMLButtonElement>('return-town-button');
const muteButton = getElement<HTMLButtonElement>('mute-button');
const restartButton = getElement<HTMLButtonElement>('restart-button');
const startButton = getElement<HTMLButtonElement>('start-button');
const startLabel = getElement('start-label');
const runModal = getElement('run-modal');
const modalKicker = getElement('modal-kicker');
const modalTitle = getElement('modal-title');
const modalCopy = getElement('modal-copy');
const bossEncounter = getElement('boss-encounter');
const bossName = getElement('boss-name');
const bossHp = getElement('boss-hp');
const bossHealthFill = getElement('boss-health-fill');
const gildingModal = getElement('gilding-modal');
const gildingOptions = getElement('gilding-options');
const dismissGildingButton = getElement<HTMLButtonElement>('dismiss-gilding-button');
const gildedStatus = getElement('gilded-status');
const townLoadoutModal = getElement('town-loadout-modal');
const townLoadoutOptions = getElement('town-loadout-options');
const dismissTownLoadoutButton = getElement<HTMLButtonElement>('dismiss-town-loadout-button');
const regionMapModal = getElement('region-map-modal');
const regionMapOptions = getElement('region-map-options');
const dismissRegionMapButton = getElement<HTMLButtonElement>('dismiss-region-map-button');
const discardModal = getElement('discard-modal');
const discardItemName = getElement('discard-item-name');
const discardWarning = getElement('discard-warning');
const dismissDiscardButton = getElement<HTMLButtonElement>('dismiss-discard-button');
const confirmDiscardButton = getElement<HTMLButtonElement>('confirm-discard-button');

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
    const slot = document.createElement('div');
    slot.className = `bag-slot${item ? ` has-item rarity-${item.rarity}${item.gilded ? ' is-gilded' : ''}` : ''}`;

    if (item) {
      const itemButton = document.createElement('button');
      itemButton.type = 'button';
      itemButton.className = 'bag-item-button';
      itemButton.title = `${item.name}：${item.description}`;
      itemButton.setAttribute('aria-label', `${item.name}，${item.description}`);
      itemButton.innerHTML = `
        <span class="slot-index">${index + 1}</span>
        <i data-lucide="${iconForItem(item)}" aria-hidden="true"></i>
        <strong>${item.gilded ? '铭金 · ' : ''}${item.name}</strong>
        <small>${item.description}</small>
      `;
      itemButton.addEventListener('click', () => sendCommand({ action: 'use-item', index }));

      const discardButton = document.createElement('button');
      discardButton.type = 'button';
      discardButton.className = 'bag-discard-button';
      discardButton.title = `丢弃${item.name}`;
      discardButton.setAttribute('aria-label', `丢弃${item.name}`);
      discardButton.innerHTML = '<i data-lucide="trash-2" aria-hidden="true"></i>';
      discardButton.addEventListener('click', () => sendCommand({ action: 'request-discard', index }));
      slot.append(itemButton, discardButton);
    } else {
      slot.setAttribute('aria-label', `空行囊位 ${index + 1}`);
      slot.innerHTML = `<span class="slot-index">${index + 1}</span><i data-lucide="package" aria-hidden="true"></i>`;
    }

    bagGrid.append(slot);
  }
}

function renderDiscard(state: UiState): void {
  const candidate = state.discardCandidate;
  discardModal.hidden = !candidate;
  if (!candidate) return;

  discardItemName.textContent = candidate.name;
  if (candidate.type === 'scroll') {
    discardWarning.textContent = '丢弃后将失去当前卷轴，后续普通层仍有机会再次发现。';
  } else if (candidate.gilded) {
    discardWarning.textContent = '若该装备尚未带出，对应的待带出记录也会取消。';
  } else {
    discardWarning.textContent = '该物品将从本次远征行囊中移除。';
  }
}

function renderGilding(state: UiState): void {
  const options = state.gildingOptions;
  gildingModal.hidden = !options;
  gildingOptions.replaceChildren();
  if (!options) return;

  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gilding-option';
    button.innerHTML = `
      <i data-lucide="${option.type === 'weapon' ? 'sword' : 'shield'}" aria-hidden="true"></i>
      <span>
        <small>${option.source === 'equipped' ? '当前装备' : '行囊装备'}</small>
        <strong>${option.name}</strong>
      </span>
      <b>+${option.power}</b>
    `;
    button.addEventListener('click', () => sendCommand({ action: 'gild-item', targetId: option.targetId }));
    gildingOptions.append(button);
  }
}

function renderModal(state: UiState): void {
  if (state.status === 'active' || state.status === 'town') {
    runModal.classList.remove('is-visible');
    return;
  }

  runModal.classList.add('is-visible');
  if (state.status === 'dead') {
    modalKicker.textContent = `止步 · 第 ${state.floor} 层`;
    modalTitle.textContent = '火把已经熄灭';
    modalCopy.textContent = `${state.gold} 枚古币和本次装备永远留在了洞里。`;
    startLabel.textContent = '返回城镇';
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

function renderTownLoadout(state: UiState): void {
  const options = state.townLoadoutOptions;
  townLoadoutModal.hidden = !options;
  townLoadoutOptions.replaceChildren();
  if (!options) return;

  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `town-loadout-option${option.equipped ? ' is-equipped' : ''}`;
    button.innerHTML = `
      <i data-lucide="${option.type === 'weapon' ? 'sword' : 'shield'}" aria-hidden="true"></i>
      <span>
        <small>${option.starter ? '初始装备' : '铭金装备'}</small>
        <strong>${option.name}</strong>
      </span>
      <b>${option.equipped ? '已装备' : `+${option.power}`}</b>
    `;
    button.addEventListener('click', () => sendCommand({ action: 'equip-town', targetId: option.targetId }));
    townLoadoutOptions.append(button);
  }
}

function renderRegionMap(state: UiState): void {
  const options = state.regionOptions;
  regionMapModal.hidden = !options;
  regionMapOptions.replaceChildren();
  if (!options) return;

  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'region-map-option';
    button.innerHTML = `
      <span class="map-thumbnail">
        <i data-lucide="map" aria-hidden="true"></i>
        <b>${String(option.index + 1).padStart(2, '0')}</b>
      </span>
      <span class="map-copy">
        <small>第 ${option.index + 1} 区间</small>
        <strong>${option.name}</strong>
        <em>${option.startFloor}～${option.endFloor} 层</em>
      </span>
      <span class="map-start">第 ${option.startFloor} 层</span>
    `;
    button.addEventListener('click', () => sendCommand({ action: 'start-region', regionIndex: option.index }));
    regionMapOptions.append(button);
  }
}

function renderState(state: UiState): void {
  areaValue.textContent = state.areaLabel;
  bossFloorMarker.classList.toggle('is-visible', state.isBossFloor);
  hpValue.textContent = `${state.hp} / ${state.maxHp}`;
  hpFill.style.width = `${Math.max(0, (state.hp / state.maxHp) * 100)}%`;
  hpFill.classList.toggle('is-low', state.hp / state.maxHp <= 0.3);
  goldValue.textContent = String(state.gold);
  bankedValue.textContent = String(state.bankedGold);
  combatValue.textContent = `战力 ${state.attack + state.defense}`;
  weaponValue.textContent = `${state.weapon.gilded ? '铭金 · ' : ''}${state.weapon.name} · +${state.weapon.power}`;
  armorValue.textContent = `${state.armor.gilded ? '铭金 · ' : ''}${state.armor.name} · +${state.armor.power}`;
  weaponValue.closest('.equipment-row')?.classList.toggle('is-gilded', Boolean(state.weapon.gilded));
  armorValue.closest('.equipment-row')?.classList.toggle('is-gilded', Boolean(state.armor.gilded));
  bagCount.textContent = `${state.inventory.length} / 6`;

  bossEncounter.hidden = !state.boss;
  if (state.boss) {
    bossName.textContent = state.boss.name;
    bossHp.textContent = `${state.boss.hp} / ${state.boss.maxHp}`;
    bossHealthFill.style.width = `${Math.max(0, (state.boss.hp / state.boss.maxHp) * 100)}%`;
  }

  renderGilding(state);
  renderTownLoadout(state);
  renderRegionMap(state);
  renderDiscard(state);
  renderInventory(state.inventory);
  gildedStatus.hidden = state.pendingGilded.length === 0;
  gildedStatus.replaceChildren(
    ...state.pendingGilded.map((equipment) => {
      const row = document.createElement('span');
      row.textContent = `待带出 · ${equipment.name} +${equipment.power}`;
      return row;
    }),
  );
  eventLog.replaceChildren(
    ...state.log.map((entry) => {
      const item = document.createElement('li');
      item.textContent = entry;
      return item;
    }),
  );

  const hasScroll = state.inventory.some((item) => item.type === 'scroll');
  escapeButton.disabled = state.status !== 'active' || !hasScroll;
  returnTownButton.hidden = !state.canReturnToTown;
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
restartButton.addEventListener('click', () => sendCommand({ action: 'enter-town' }));
muteButton.addEventListener('click', () => sendCommand({ action: 'mute' }));
escapeButton.addEventListener('click', () => sendCommand({ action: 'escape' }));
returnTownButton.addEventListener('click', () => sendCommand({ action: 'return-town' }));
dismissGildingButton.addEventListener('click', () => sendCommand({ action: 'dismiss-gilding' }));
dismissTownLoadoutButton.addEventListener('click', () => sendCommand({ action: 'dismiss-town-loadout' }));
dismissRegionMapButton.addEventListener('click', () => sendCommand({ action: 'dismiss-region-map' }));
dismissDiscardButton.addEventListener('click', () => sendCommand({ action: 'dismiss-discard' }));
confirmDiscardButton.addEventListener('click', () => sendCommand({ action: 'confirm-discard' }));

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
