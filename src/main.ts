import Phaser from 'phaser';
import { createIcons, icons } from 'lucide';
import './style.css';
import { GameScene } from './game/GameScene';
import {
  equipmentTierLabel,
  getEnhancementBonus,
  getEnhancementLevel,
  getEquipmentTier,
} from './game/equipment';
import {
  COMMAND_EVENT,
  UI_EVENT,
  type Equipment,
  type EquipmentAffix,
  type GameCommand,
  type Item,
  type UiState,
} from './game/types';

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
const weaponDetail = getElement('weapon-detail');
const armorDetail = getElement('armor-detail');
const setBonus = getElement('set-bonus');
const bagSection = getElement('bag-section');
const bagCount = getElement('bag-count');
const bagGrid = getElement('bag-grid');
const logSection = getElement('log-section');
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
const townEquippedSummary = getElement('town-equipped-summary');
const townStarterActions = getElement('town-starter-actions');
const townVaultCount = getElement('town-vault-count');
const artisanModal = getElement('artisan-modal');
const artisanOptions = getElement('artisan-options');
const artisanDetail = getElement('artisan-detail');
const artisanBankedGold = getElement('artisan-banked-gold');
const dismissArtisanButton = getElement<HTMLButtonElement>('dismiss-artisan-button');
const enhancementConfirmation = getElement('enhancement-confirmation');
const enhancementConfirmationItem = getElement('enhancement-confirmation-item');
const enhancementConfirmationCopy = getElement('enhancement-confirmation-copy');
const dismissEnhancementConfirmationButton = getElement<HTMLButtonElement>('dismiss-enhancement-confirmation-button');
const confirmEnhancementButton = getElement<HTMLButtonElement>('confirm-enhancement-button');
const regionMapModal = getElement('region-map-modal');
const regionMapOptions = getElement('region-map-options');
const dismissRegionMapButton = getElement<HTMLButtonElement>('dismiss-region-map-button');
const merchantModal = getElement('merchant-modal');
const merchantOffers = getElement('merchant-offers');
const dismissMerchantButton = getElement<HTMLButtonElement>('dismiss-merchant-button');
const merchantReveal = getElement('merchant-reveal');
const merchantRevealKicker = getElement('merchant-reveal-kicker');
const merchantRevealItemIcon = getElement('merchant-reveal-item-icon');
const merchantRevealName = getElement('merchant-reveal-name');
const merchantRevealPower = getElement('merchant-reveal-power');
const discardModal = getElement('discard-modal');
const discardItemName = getElement('discard-item-name');
const discardKicker = getElement('discard-kicker');
const discardWarning = getElement('discard-warning');
const dismissDiscardButton = getElement<HTMLButtonElement>('dismiss-discard-button');
const confirmDiscardButton = getElement<HTMLButtonElement>('confirm-discard-button');
let merchantRevealTimer: number | undefined;
let activeMerchantRevealSequence = 0;

function sendCommand(command: GameCommand): void {
  window.dispatchEvent(new CustomEvent<GameCommand>(COMMAND_EVENT, { detail: command }));
}

function iconForItem(item: Item): string {
  const iconsByType: Record<Item['type'], string> = {
    potion: 'flask-conical',
    weapon: 'sword',
    armor: 'shield',
    scroll: 'scroll-text',
    material: 'gem',
  };
  return iconsByType[item.type];
}

function affixText(affix: EquipmentAffix): string {
  const statLabels: Record<EquipmentAffix['stat'], string> = {
    attack: '攻击',
    defense: '防御',
    maxHp: '生命上限',
    crit: '暴击率',
    bleed: '流血伤害',
  };
  const value = affix.stat === 'crit'
    ? ` +${affix.value}%`
    : (affix.stat === 'bleed' ? ` +${affix.value}/回合` : ` +${affix.value}`);
  return `${affix.label} · ${statLabels[affix.stat]}${value}`;
}

function renderEquipmentValue(
  element: HTMLElement,
  equipment: Equipment,
  type: 'weapon' | 'armor',
): void {
  const enhancement = getEnhancementBonus(type, equipment);
  const enhancementLevel = getEnhancementLevel(equipment);
  const title = document.createElement('span');
  title.className = 'equipment-name-line';

  const tier = document.createElement('span');
  tier.className = 'equipment-tier-label';
  tier.textContent = equipmentTierLabel(getEquipmentTier(equipment));
  const name = document.createElement('span');
  name.className = 'equipment-item-name';
  name.textContent = equipment.name;
  title.append(tier, name);

  const stats = document.createElement('span');
  stats.className = 'equipment-stat-line';
  const primary = document.createElement('span');
  primary.className = 'equipment-stat is-primary';
  primary.innerHTML = `<small>${type === 'weapon' ? '攻击' : '防御'}</small><b>+${equipment.power + enhancement.attack}</b>`;
  stats.append(primary);

  if (enhancement.maxHp > 0) {
    const health = document.createElement('span');
    health.className = 'equipment-stat is-health';
    health.innerHTML = `<small>生命</small><b>+${enhancement.maxHp}</b>`;
    stats.append(health);
  }
  if (enhancementLevel > 0) {
    const level = document.createElement('span');
    level.className = 'equipment-stat is-enhancement';
    level.innerHTML = `<small>强化</small><b>+${enhancementLevel}</b>`;
    stats.append(level);
  }

  element.replaceChildren(title, stats);
}

function renderInventory(items: Item[], capacity: number): void {
  bagGrid.replaceChildren();

  for (let index = 0; index < capacity; index += 1) {
    const item = items[index];
    const slot = document.createElement('div');
    const tier = item && (item.type === 'weapon' || item.type === 'armor') ? getEquipmentTier(item) : undefined;
    slot.className = `bag-slot${item ? ` has-item rarity-${item.rarity}${item.gilded ? ' is-gilded' : ''}${tier ? ` tier-${tier}` : ''}${item.affixes?.length ? ' has-affix' : ''}` : ''}`;

    if (item) {
      const quantity = Math.max(1, item.quantity ?? 1);
      const itemButton = document.createElement('button');
      itemButton.type = 'button';
      itemButton.className = 'bag-item-button';
      itemButton.disabled = item.type === 'material';
      itemButton.title = item.type === 'material'
        ? `${item.name}：材料不能直接使用或装备`
        : `${item.name}：${item.description}`;
      itemButton.setAttribute('aria-label', `${item.name}，${item.description}${quantity > 1 ? `，数量 ${quantity}` : ''}`);
      itemButton.innerHTML = `
        <span class="slot-index">${index + 1}</span>
        <i data-lucide="${iconForItem(item)}" aria-hidden="true"></i>
        <strong>${tier ? `${equipmentTierLabel(tier)} · ` : ''}${item.name}</strong>
        <small>${item.description}</small>
        ${item.affixes?.map((affix) => `<em class="slot-affix">${affixText(affix)}</em>`).join('') ?? ''}
        ${item.setName ? `<em class="slot-set">套装 · ${item.setName}</em>` : ''}
        ${quantity > 1 ? `<b class="slot-quantity">×${quantity}</b>` : ''}
      `;
      if (item.type !== 'material') {
        itemButton.addEventListener('click', () => sendCommand({ action: 'use-item', index }));
      }

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

  discardItemName.textContent = `${candidate.name}${candidate.quantity > 1 ? ` ×${candidate.quantity}` : ''}`;
  if (candidate.source === 'vault') {
    discardKicker.textContent = '仓库管理';
    discardWarning.textContent = '该装备将从城镇仓库永久删除，且无法恢复。';
  } else if (candidate.type === 'scroll') {
    discardKicker.textContent = '行囊管理';
    discardWarning.textContent = '丢弃后将失去当前卷轴，后续普通层仍有机会再次发现。';
  } else if (candidate.gilded) {
    discardKicker.textContent = '行囊管理';
    discardWarning.textContent = '若该装备尚未带出，对应的待带出记录也会取消。';
  } else {
    discardKicker.textContent = '行囊管理';
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
      <i data-lucide="${option.type === 'weapon' ? 'sword' : (option.type === 'armor' ? 'shield' : 'gem')}" aria-hidden="true"></i>
      <span>
        <small>${option.source === 'equipped' ? '当前装备' : '行囊装备'}</small>
        <strong>${option.name}</strong>
      </span>
      <b>${option.type === 'material' ? `×${option.quantity ?? 1}` : `+${option.power}`}</b>
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
  townEquippedSummary.replaceChildren();
  townStarterActions.replaceChildren();
  if (!options) return;

  for (const equipment of [
    { type: 'weapon' as const, label: '武器', value: state.weapon },
    { type: 'armor' as const, label: '护甲', value: state.armor },
  ]) {
    const row = document.createElement('div');
    row.className = `warehouse-equipped-row tier-${getEquipmentTier(equipment.value)}${equipment.value.gilded ? ' is-gilded' : ''}`;
    row.innerHTML = `
      <i data-lucide="${equipment.type === 'weapon' ? 'sword' : 'shield'}" aria-hidden="true"></i>
      <span><small>${equipmentTierLabel(getEquipmentTier(equipment.value))} · ${equipment.label} · 强化 +${getEnhancementLevel(equipment.value)}</small><strong>${equipment.value.name}</strong></span>
      <b>+${equipment.value.power}</b>
    `;
    for (const affix of equipment.value.affixes ?? []) {
      const detail = document.createElement('em');
      detail.textContent = affixText(affix);
      row.append(detail);
    }
    townEquippedSummary.append(row);
  }

  for (const option of options.filter((item) => item.starter)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `starter-loadout-button${option.equipped ? ' is-equipped' : ''}`;
    button.textContent = option.type === 'weapon' ? '使用初始武器' : '使用初始护甲';
    button.addEventListener('click', () => sendCommand({ action: 'equip-town', targetId: option.targetId }));
    townStarterActions.append(button);
  }

  const vaultOptions = options.filter((item) => !item.starter);
  townVaultCount.textContent = `${vaultOptions.length} 件`;
  if (vaultOptions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'warehouse-empty';
    empty.innerHTML = '<i data-lucide="archive" aria-hidden="true"></i><span>仓库暂无铭金装备</span>';
    townLoadoutOptions.append(empty);
    return;
  }

  for (const option of vaultOptions) {
    const item = document.createElement('div');
    item.className = `town-vault-item rarity-${option.rarity} tier-${option.tier}${option.equipped ? ' is-equipped' : ''}${option.affixes.length ? ' has-affix' : ''}`;

    const equipButton = document.createElement('button');
    equipButton.type = 'button';
    equipButton.className = 'town-vault-equip';
    equipButton.setAttribute('aria-label', `装备${option.name}`);
    equipButton.innerHTML = `
      <i data-lucide="${option.type === 'weapon' ? 'sword' : 'shield'}" aria-hidden="true"></i>
      <span>
        <small>${equipmentTierLabel(option.tier)} · ${option.type === 'weapon' ? '武器' : '护甲'} · 强化 +${option.enhancementLevel}</small>
        <strong>${option.name}</strong>
        ${option.affixes.map((affix) => `<em>${affixText(affix)}</em>`).join('')}
        ${option.setName ? `<em>套装 · ${option.setName}</em>` : ''}
      </span>
      <b>${option.equipped ? '已装备' : `+${option.power}`}</b>
    `;
    equipButton.addEventListener('click', () => sendCommand({ action: 'equip-town', targetId: option.targetId }));

    const discardButton = document.createElement('button');
    discardButton.type = 'button';
    discardButton.className = 'town-vault-discard';
    discardButton.title = `永久删除${option.name}`;
    discardButton.setAttribute('aria-label', `永久删除${option.name}`);
    discardButton.innerHTML = '<i data-lucide="trash-2" aria-hidden="true"></i>';
    discardButton.addEventListener('click', () => sendCommand({ action: 'request-vault-discard', targetId: option.targetId }));

    item.append(equipButton, discardButton);
    townLoadoutOptions.append(item);
  }
}

function renderArtisan(state: UiState): void {
  const options = state.artisanOptions;
  artisanModal.hidden = !options;
  artisanOptions.replaceChildren();
  artisanDetail.replaceChildren();
  artisanBankedGold.textContent = String(state.bankedGold);
  const confirmation = state.enhancementConfirmation;
  enhancementConfirmation.hidden = !confirmation;
  if (confirmation) {
    enhancementConfirmationItem.textContent = `${confirmation.name} · 目标强化 +${confirmation.nextLevel}`;
    enhancementConfirmationCopy.textContent = `本次成功率 ${confirmation.successChance}%，将消耗 ${confirmation.cost} 枚入库古币。失败会消耗古币，但装备不会损坏或降级。是否继续？`;
  }
  if (!options) return;

  if (options.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'artisan-empty';
    empty.innerHTML = '<i data-lucide="archive" aria-hidden="true"></i><span>仓库中暂无可强化装备</span>';
    artisanOptions.append(empty);
    artisanDetail.innerHTML = '<div class="artisan-detail-empty"><i data-lucide="hammer" aria-hidden="true"></i><span>带回金装及以上装备后可以强化</span></div>';
    return;
  }

  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `artisan-option tier-${option.tier}${state.artisanSelectedId === option.targetId ? ' is-selected' : ''}${option.equipped ? ' is-equipped' : ''}`;
    button.innerHTML = `
      <i data-lucide="${option.type === 'weapon' ? 'sword' : 'shield'}" aria-hidden="true"></i>
      <span>
        <small>${equipmentTierLabel(option.tier)} · ${option.type === 'weapon' ? '武器' : '护甲'}${option.equipped ? ' · 已装备' : ''}</small>
        <strong>${option.name}</strong>
        <em>强化 +${option.enhancementLevel} / +${option.maxLevel}</em>
      </span>
      <b>+${option.enhancementLevel}</b>
    `;
    button.addEventListener('click', () => sendCommand({ action: 'select-artisan-equipment', targetId: option.targetId }));
    artisanOptions.append(button);
  }

  const selected = options.find((option) => option.targetId === state.artisanSelectedId);
  if (!selected) {
    artisanDetail.innerHTML = '<div class="artisan-detail-empty"><i data-lucide="mouse-pointer-click" aria-hidden="true"></i><span>从左侧选择一件装备</span></div>';
    return;
  }

  const atMax = selected.enhancementLevel >= selected.maxLevel;
  const gains = [
    selected.attackPerLevel > 0 ? `攻击 +${selected.attackPerLevel}` : '',
    selected.maxHpPerLevel > 0 ? `生命 +${selected.maxHpPerLevel}` : '',
  ].filter(Boolean).join(' · ');
  const totalGains = [
    selected.attackPerLevel > 0 ? `攻击 +${selected.attackPerLevel * selected.enhancementLevel}` : '',
    selected.maxHpPerLevel > 0 ? `生命 +${selected.maxHpPerLevel * selected.enhancementLevel}` : '',
  ].filter(Boolean).join(' · ') || '尚未获得强化属性';
  artisanDetail.innerHTML = `
    <div class="artisan-detail-title tier-${selected.tier}${selected.equipped ? ' is-equipped' : ''}">
      <i data-lucide="${selected.type === 'weapon' ? 'sword' : 'shield'}" aria-hidden="true"></i>
      <span><small>${equipmentTierLabel(selected.tier)} · ${selected.type === 'weapon' ? '武器' : '护甲'}${selected.equipped ? ' · 已装备' : ''}</small><strong>${selected.name}</strong></span>
    </div>
    <div class="artisan-level-track"><span>+${selected.enhancementLevel}</span><i></i><b>+${selected.maxLevel}</b></div>
    <dl class="artisan-detail-stats">
      <div><dt>每级固定增加</dt><dd>${gains}</dd></div>
      <div><dt>当前强化收益</dt><dd>${totalGains}</dd></div>
      <div><dt>下一级成功率</dt><dd class="${selected.successChance < 50 ? 'is-danger' : ''}">${atMax ? '已满级' : `${selected.successChance}%`}</dd></div>
      <div><dt>本次费用</dt><dd>${atMax ? '—' : `${selected.nextCost} 古币`}</dd></div>
    </dl>
  `;
  if (state.enhancementResult?.targetId === selected.targetId) {
    const result = document.createElement('div');
    result.className = `artisan-result ${state.enhancementResult.success ? 'is-success' : 'is-failure'}`;
    result.textContent = state.enhancementResult.message;
    artisanDetail.append(result);
  }
  const enhanceButton = document.createElement('button');
  enhanceButton.type = 'button';
  enhanceButton.className = 'artisan-enhance-button';
  enhanceButton.disabled = atMax || !selected.canEnhance;
  enhanceButton.innerHTML = atMax
    ? '<i data-lucide="badge-check" aria-hidden="true"></i><span>已达到强化上限</span>'
    : `<i data-lucide="hammer" aria-hidden="true"></i><span>${selected.canEnhance ? `强化到 +${selected.enhancementLevel + 1}` : `还需 ${selected.nextCost} 古币`}</span>`;
  enhanceButton.addEventListener('click', () => sendCommand({ action: 'enhance-equipment', targetId: selected.targetId }));
  artisanDetail.append(enhanceButton);
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

function renderMerchant(state: UiState): void {
  const offers = state.merchantOffers;
  const reveal = state.merchantReveal;
  merchantModal.hidden = !offers;
  merchantReveal.hidden = !reveal;
  merchantReveal.className = reveal ? `merchant-reveal tier-${reveal.tier}` : 'merchant-reveal';
  merchantOffers.replaceChildren();
  if (!offers) {
    if (merchantRevealTimer !== undefined) window.clearTimeout(merchantRevealTimer);
    merchantRevealTimer = undefined;
    activeMerchantRevealSequence = 0;
    return;
  }

  if (reveal) {
    merchantRevealKicker.textContent = `${reveal.regionName}罐 · ${equipmentTierLabel(reveal.tier)}`;
    merchantRevealItemIcon.innerHTML = `<i data-lucide="${reveal.type === 'weapon' ? 'sword' : 'shield'}" aria-hidden="true"></i>`;
    merchantRevealName.textContent = reveal.name;
    merchantRevealPower.textContent = `${reveal.type === 'weapon' ? '武器 · 攻击' : '护甲 · 防御'} +${reveal.power}`;
    if (reveal.sequence !== activeMerchantRevealSequence) {
      activeMerchantRevealSequence = reveal.sequence;
      if (merchantRevealTimer !== undefined) window.clearTimeout(merchantRevealTimer);
      merchantRevealTimer = window.setTimeout(() => {
        sendCommand({ action: 'dismiss-merchant-reveal' });
      }, 3000);
    }
  } else {
    if (merchantRevealTimer !== undefined) window.clearTimeout(merchantRevealTimer);
    merchantRevealTimer = undefined;
    activeMerchantRevealSequence = 0;
  }

  for (const offer of offers) {
    const item = document.createElement('article');
    item.className = 'merchant-offer';
    item.innerHTML = `
      <i data-lucide="package-open" aria-hidden="true"></i>
      <span>
        <small>${offer.regionName} · ${offer.regionIndex === 0 ? '无紫装' : '紫装 5%'}</small>
        <strong>${offer.regionName}罐</strong>
        <em>${offer.name} ${offer.quantity} / ${offer.cost}</em>
      </span>
    `;
    const button = document.createElement('button');
    button.type = 'button';
    button.disabled = !offer.canBuy || Boolean(reveal);
    button.textContent = reveal ? '开启中' : (offer.canBuy ? '兑换' : '材料不足');
    button.addEventListener('click', () => sendCommand({
      action: 'buy-region-jar',
      regionIndex: offer.regionIndex,
    }));
    item.append(button);
    merchantOffers.append(item);
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
  renderEquipmentValue(weaponValue, state.weapon, 'weapon');
  renderEquipmentValue(armorValue, state.armor, 'armor');
  weaponDetail.hidden = !state.weapon.affixes?.length;
  weaponDetail.textContent = state.weapon.affixes?.map(affixText).join('；') ?? '';
  armorDetail.hidden = !state.armor.affixes?.length;
  armorDetail.textContent = state.armor.affixes?.map(affixText).join('；') ?? '';
  setBonus.hidden = !state.activeSetBonus;
  setBonus.textContent = state.activeSetBonus
    ? `套装激活 · ${state.activeSetBonus.setName} · ${affixText(state.activeSetBonus.affix)}`
    : '';
  weaponValue.closest('.equipment-row')?.classList.toggle('is-gilded', Boolean(state.weapon.gilded));
  armorValue.closest('.equipment-row')?.classList.toggle('is-gilded', Boolean(state.armor.gilded));
  for (const [element, equipment] of [
    [weaponValue.closest('.equipment-row'), state.weapon],
    [armorValue.closest('.equipment-row'), state.armor],
  ] as const) {
    if (!element) continue;
    element.classList.remove('tier-common', 'tier-gold', 'tier-dark-gold', 'tier-purple');
    element.classList.add(`tier-${getEquipmentTier(equipment)}`);
  }
  bagCount.textContent = `${state.inventory.length} / ${state.inventoryCapacity}`;
  bagSection.hidden = state.inTown;
  logSection.hidden = state.inTown;

  bossEncounter.hidden = !state.boss;
  if (state.boss) {
    bossName.textContent = state.boss.name;
    bossHp.textContent = `${state.boss.hp} / ${state.boss.maxHp}`;
    bossHealthFill.style.width = `${Math.max(0, (state.boss.hp / state.boss.maxHp) * 100)}%`;
  }

  renderGilding(state);
  renderTownLoadout(state);
  renderArtisan(state);
  renderRegionMap(state);
  renderMerchant(state);
  renderDiscard(state);
  renderInventory(state.inventory, state.inventoryCapacity);
  gildedStatus.replaceChildren(
    ...state.pendingGilded.map((equipment) => {
      const row = document.createElement('span');
      row.textContent = `待带出 · ${equipmentTierLabel(getEquipmentTier(equipment))} · ${equipment.name} +${equipment.power}`;
      return row;
    }),
    ...state.pendingMaterials.map((material) => {
      const row = document.createElement('span');
      row.textContent = `待带出 · ${material.name} ×${material.quantity}`;
      return row;
    }),
  );
  gildedStatus.hidden = state.pendingGilded.length === 0 && state.pendingMaterials.length === 0;
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
dismissArtisanButton.addEventListener('click', () => sendCommand({ action: 'dismiss-artisan' }));
dismissEnhancementConfirmationButton.addEventListener('click', () => sendCommand({ action: 'dismiss-enhancement-confirmation' }));
confirmEnhancementButton.addEventListener('click', () => sendCommand({ action: 'confirm-enhancement' }));
dismissRegionMapButton.addEventListener('click', () => sendCommand({ action: 'dismiss-region-map' }));
dismissMerchantButton.addEventListener('click', () => sendCommand({ action: 'dismiss-merchant' }));
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
