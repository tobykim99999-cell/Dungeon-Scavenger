import Phaser from 'phaser';
import { createIcons, icons } from 'lucide';
import './style.css';
import { GameScene } from './game/GameScene';
import {
  equipmentTierLabel,
  getEnhancementBonus,
  getEnhancementLevel,
  getEquipmentScore,
  getEquipmentTier,
} from './game/equipment';
import {
  COMMAND_EVENT,
  LOOT_ANIMATION_EVENT,
  UI_EVENT,
  type BestiaryCreature,
  type Equipment,
  type EquipmentAffix,
  type GameCommand,
  type Item,
  type LootAnimationDetail,
  type UiState,
} from './game/types';
import {
  createSaveBackup,
  parseSaveBackup,
  restoreSaveBackup,
} from './game/saveTransfer';

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
const skillsSection = getElement('skills-section');
const skillGrid = getElement('skill-grid');
const bagCount = getElement('bag-count');
const bagGrid = getElement('bag-grid');
const logTitle = getElement('log-title');
const eventLog = getElement<HTMLOListElement>('event-log');
const escapeButton = getElement<HTMLButtonElement>('escape-button');
const returnTownButton = getElement<HTMLButtonElement>('return-town-button');
const muteButton = getElement<HTMLButtonElement>('mute-button');
const restartButton = getElement<HTMLButtonElement>('restart-button');
const startButton = getElement<HTMLButtonElement>('start-button');
const startLabel = getElement('start-label');
const saveButton = getElement<HTMLButtonElement>('save-button');
const saveModal = getElement('save-modal');
const dismissSaveButton = getElement<HTMLButtonElement>('dismiss-save-button');
const exportSaveButton = getElement<HTMLButtonElement>('export-save-button');
const importSaveButton = getElement<HTMLButtonElement>('import-save-button');
const saveFileInput = getElement<HTMLInputElement>('save-file-input');
const saveStatus = getElement('save-status');
const runModal = getElement('run-modal');
const modalKicker = getElement('modal-kicker');
const modalTitle = getElement('modal-title');
const modalCopy = getElement('modal-copy');
const bossEncounter = getElement('boss-encounter');
const bossName = getElement('boss-name');
const bossHp = getElement('boss-hp');
const bossHealthFill = getElement('boss-health-fill');
const bossShield = getElement('boss-shield');
const bossShieldFill = getElement('boss-shield-fill');
const bossShieldValue = getElement('boss-shield-value');
const bossHealing = getElement('boss-healing');
const bossHealingTurns = getElement('boss-healing-turns');
const bossSkillWarning = getElement('boss-skill-warning');
const bossSkillName = getElement('boss-skill-name');
const playerEffects = getElement('player-effects');
const playerControlEffect = getElement('player-control-effect');
const playerBurnEffect = getElement('player-burn-effect');
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
const bestiaryModal = getElement('bestiary-modal');
const bestiaryRegions = getElement('bestiary-regions');
const dismissBestiaryButton = getElement<HTMLButtonElement>('dismiss-bestiary-button');
const regionMapModal = getElement('region-map-modal');
const regionMapOptions = getElement('region-map-options');
const dismissRegionMapButton = getElement<HTMLButtonElement>('dismiss-region-map-button');
const normalRegionModeButton = getElement<HTMLButtonElement>('normal-region-mode');
const heroicRegionModeButton = getElement<HTMLButtonElement>('heroic-region-mode');
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
const bossExitModal = getElement('boss-exit-modal');
const dismissBossExitButton = getElement<HTMLButtonElement>('dismiss-boss-exit-button');
const bossExitReturnButton = getElement<HTMLButtonElement>('boss-exit-return-button');
const bossExitContinueButton = getElement<HTMLButtonElement>('boss-exit-continue-button');
let merchantRevealTimer: number | undefined;
let activeMerchantRevealSequence = 0;
const TINY_DUNGEON_SHEET = `${import.meta.env.BASE_URL}assets/kenney-tiny-dungeon/Tilemap/tilemap_packed.png`;

function sendCommand(command: GameCommand): void {
  window.dispatchEvent(new CustomEvent<GameCommand>(COMMAND_EVENT, { detail: command }));
}

function openSaveManager(): void {
  saveStatus.textContent = '当前洞窟内尚未带回的物品不属于永久存档';
  saveStatus.classList.remove('is-error');
  saveModal.hidden = false;
  createIcons({ icons });
}

function closeSaveManager(): void {
  saveModal.hidden = true;
  saveFileInput.value = '';
}

function exportSave(): void {
  const backup = createSaveBackup(localStorage);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const date = backup.exportedAt.slice(0, 10);
  anchor.href = url;
  anchor.download = `深渊拾荒者-存档-${date}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  saveStatus.textContent = `存档已导出 · ${date}`;
  saveStatus.classList.remove('is-error');
}

async function importSave(file: File): Promise<void> {
  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    const backup = parseSaveBackup(parsed);
    if (!backup) throw new Error('存档文件格式或版本不正确');
    const exportedAt = new Date(backup.exportedAt).toLocaleString('zh-CN');
    const confirmed = window.confirm(`将使用 ${exportedAt} 的备份覆盖本浏览器现有进度。是否继续？`);
    if (!confirmed) return;
    restoreSaveBackup(localStorage, backup);
    window.location.reload();
  } catch (error) {
    saveStatus.textContent = error instanceof Error ? error.message : '无法读取存档文件';
    saveStatus.classList.add('is-error');
  } finally {
    saveFileInput.value = '';
  }
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

function equipmentScoreMarkup(score: number, className = ''): string {
  return `<span class="equipment-score${className ? ` ${className}` : ''}" aria-label="装备评分 ${score}"><i data-lucide="gauge" aria-hidden="true"></i><small>评分</small><b>${score}</b></span>`;
}

function warehouseAttributesMarkup(type: 'weapon' | 'armor', equipment: Equipment): string {
  const enhancement = getEnhancementBonus(type, equipment);
  const attributes = [
    `<span class="warehouse-attribute is-base"><small>原始属性</small><b>${type === 'weapon' ? '攻击' : '防御'} +${equipment.power}</b></span>`,
  ];
  if (enhancement.attack > 0 || enhancement.defense > 0 || enhancement.maxHp > 0) {
    const gains = [
      enhancement.attack > 0 ? `攻击 +${enhancement.attack}` : '',
      enhancement.defense > 0 ? `防御 +${enhancement.defense}` : '',
      enhancement.maxHp > 0 ? `生命 +${enhancement.maxHp}` : '',
    ].filter(Boolean).join(' · ');
    attributes.push(`<span class="warehouse-attribute is-enhancement"><small>强化收益</small><b>${gains}</b></span>`);
  }
  for (const affix of equipment.affixes ?? []) {
    attributes.push(`<span class="warehouse-attribute is-affix"><small>附加词条</small><b>${affixText(affix)}</b></span>`);
  }
  if (equipment.setName) {
    const setDescription = equipment.setBonus
      ? `${equipment.setName} · ${affixText(equipment.setBonus)}`
      : equipment.setName;
    attributes.push(`<span class="warehouse-attribute is-set"><small>套装属性</small><b>${setDescription}</b></span>`);
  }
  return `<span class="warehouse-attributes">${attributes.join('')}</span>`;
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
  primary.innerHTML = `<small>${type === 'weapon' ? '攻击' : '防御'}</small><b>+${equipment.power + (type === 'weapon' ? enhancement.attack : enhancement.defense)}</b>`;
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

  const score = document.createElement('span');
  score.innerHTML = equipmentScoreMarkup(getEquipmentScore(type, equipment), 'current-equipment-score');

  element.replaceChildren(title, stats, score);
}

function renderInventory(items: Item[], capacity: number): void {
  bagGrid.replaceChildren();

  for (let index = 0; index < capacity; index += 1) {
    const item = items[index];
    const slot = document.createElement('div');
    const tier = item && (item.type === 'weapon' || item.type === 'armor') ? getEquipmentTier(item) : undefined;
    slot.className = `bag-slot${item ? ` has-item rarity-${item.rarity}${item.gilded ? ' is-gilded' : ''}${tier ? ` is-equipment tier-${tier}` : ''}${item.affixes?.length ? ' has-affix' : ''}${item.setName ? ' has-set' : ''}` : ''}`;

    if (item) {
      slot.dataset.itemId = item.id;
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
        ${tier ? `<span class="slot-equipment-tier">${equipmentTierLabel(tier)}</span>` : ''}
        <i data-lucide="${iconForItem(item)}" aria-hidden="true"></i>
        <strong>${item.name}</strong>
        <small>${item.description}</small>
        ${tier ? equipmentScoreMarkup(getEquipmentScore(item.type as 'weapon' | 'armor', item), 'slot-equipment-score') : ''}
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

function renderPlayerSkills(state: UiState): void {
  skillsSection.hidden = state.status !== 'active';
  skillGrid.replaceChildren();
  const iconsBySkill = {
    'charged-strike': 'sword',
    guard: 'shield',
    shockwave: 'waves',
    cleanse: 'sparkles',
  } as const;

  for (const skill of state.playerSkills) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `skill-button${skill.active ? ' is-active' : ''}`;
    button.disabled = !skill.ready;
    button.title = skill.description;
    const status = skill.active
      ? '已准备'
      : skill.cooldown > 0
        ? `冷却 ${skill.cooldown}`
        : skill.blocked
          ? '被控制'
          : '可使用';
    button.setAttribute('aria-label', `${skill.name}，${skill.description}，${status}`);
    button.innerHTML = `
      <i data-lucide="${iconsBySkill[skill.id]}" aria-hidden="true"></i>
      <span><strong>${skill.name}</strong><small>${status}</small></span>
    `;
    button.addEventListener('click', () => sendCommand({ action: 'use-skill', skillId: skill.id }));
    skillGrid.append(button);
  }
}

function playPremiumLootAnimation(detail: LootAnimationDetail): void {
  window.requestAnimationFrame(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-stage canvas');
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const originX = canvasRect.left + detail.worldX * (canvasRect.width / canvas.width);
    const originY = canvasRect.top + detail.worldY * (canvasRect.height / canvas.height);
    const targetSlot = [...bagGrid.querySelectorAll<HTMLElement>('[data-item-id]')]
      .find((slot) => slot.dataset.itemId === detail.itemId);
    const slotRect = targetSlot?.getBoundingClientRect();
    const fallbackRect = bagCount.getBoundingClientRect();
    const slotVisible = Boolean(
      slotRect &&
      slotRect.bottom > 0 &&
      slotRect.top < window.innerHeight &&
      slotRect.right > 0 &&
      slotRect.left < window.innerWidth
    );
    const targetRect = slotVisible ? slotRect! : fallbackRect;
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;
    const tierClass = `tier-${detail.tier}`;

    const landing = document.createElement('div');
    landing.className = `premium-loot-landing ${tierClass}`;
    landing.style.left = `${originX}px`;
    landing.style.top = `${originY}px`;
    landing.setAttribute('aria-hidden', 'true');
    landing.innerHTML = `<div class="premium-loot-ring"></div><div class="premium-loot-particles">${'<span></span>'.repeat(detail.tier === 'purple' ? 12 : 7)}</div>`;

    const flight = document.createElement('div');
    flight.className = `premium-loot-flight ${tierClass}`;
    flight.setAttribute('aria-hidden', 'true');
    flight.innerHTML = `<i data-lucide="${detail.itemType === 'weapon' ? 'sword' : 'shield'}"></i><strong>${equipmentTierLabel(detail.tier)} · ${detail.name}</strong>`;
    document.body.append(landing, flight);
    createIcons({ icons });

    const halfSize = 26;
    const duration = detail.tier === 'purple' ? 1500 : 1250;
    const animation = flight.animate([
      {
        transform: `translate(${originX - halfSize}px, ${originY - 92}px) scale(0.45) rotate(-8deg)`,
        opacity: 0,
        offset: 0,
      },
      {
        transform: `translate(${originX - halfSize}px, ${originY - halfSize}px) scale(1.18) rotate(3deg)`,
        opacity: 1,
        offset: 0.2,
      },
      {
        transform: `translate(${originX - halfSize}px, ${originY - halfSize - 12}px) scale(1) rotate(0deg)`,
        opacity: 1,
        offset: 0.48,
      },
      {
        transform: `translate(${targetX - halfSize}px, ${targetY - halfSize}px) scale(0.34) rotate(10deg)`,
        opacity: 0.92,
        offset: 0.94,
      },
      {
        transform: `translate(${targetX - halfSize}px, ${targetY - halfSize}px) scale(0.08) rotate(12deg)`,
        opacity: 0,
        offset: 1,
      },
    ], {
      duration,
      easing: 'cubic-bezier(.2,.75,.2,1)',
      fill: 'forwards',
    });

    window.setTimeout(() => landing.remove(), detail.tier === 'purple' ? 1050 : 850);
    animation.finished.finally(() => {
      flight.remove();
      bagSection.classList.remove('loot-arrival-dark-gold', 'loot-arrival-purple');
      void bagSection.offsetWidth;
      bagSection.classList.add(`loot-arrival-${detail.tier}`);
      window.setTimeout(() => bagSection.classList.remove(`loot-arrival-${detail.tier}`), 650);
    });
  });
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
        ${option.score ? equipmentScoreMarkup(option.score, 'compact-equipment-score') : ''}
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
      <span class="warehouse-card-copy"><small>${equipmentTierLabel(getEquipmentTier(equipment.value))} · ${equipment.label} · 强化 +${getEnhancementLevel(equipment.value)}</small><strong>${equipment.value.name}</strong></span>
      ${equipmentScoreMarkup(getEquipmentScore(equipment.type, equipment.value), 'warehouse-card-score')}
      ${warehouseAttributesMarkup(equipment.type, equipment.value)}
    `;
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
      <span class="warehouse-card-copy">
        <small>${equipmentTierLabel(option.tier)} · ${option.type === 'weapon' ? '武器' : '护甲'} · 强化 +${option.enhancementLevel}</small>
        <strong>${option.name}</strong>
        ${option.equipped ? '<em class="warehouse-equipped-status">已装备</em>' : ''}
        ${warehouseAttributesMarkup(option.type, {
          name: option.name,
          power: option.power,
          tier: option.tier,
          affixes: option.affixes,
          setName: option.setName,
          setBonus: option.setBonus,
          enhancementLevel: option.enhancementLevel,
        })}
      </span>
      ${equipmentScoreMarkup(option.score, 'warehouse-card-score')}
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
        <small><span class="artisan-tier-copy">${equipmentTierLabel(option.tier)} · ${option.type === 'weapon' ? '武器' : '护甲'}</span>${option.equipped ? '<b class="artisan-equipped-label">已装备</b>' : ''}</small>
        <strong>${option.name}</strong>
        <em>强化 +${option.enhancementLevel} / +${option.maxLevel}</em>
        ${equipmentScoreMarkup(option.score, 'compact-equipment-score')}
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
    selected.defensePerLevel > 0 ? `防御 +${selected.defensePerLevel}` : '',
    selected.maxHpPerLevel > 0 ? `生命 +${selected.maxHpPerLevel}` : '',
  ].filter(Boolean).join(' · ');
  const totalGains = [
    selected.attackPerLevel > 0 ? `攻击 +${selected.attackPerLevel * selected.enhancementLevel}` : '',
    selected.defensePerLevel > 0 ? `防御 +${selected.defensePerLevel * selected.enhancementLevel}` : '',
    selected.maxHpPerLevel > 0 ? `生命 +${selected.maxHpPerLevel * selected.enhancementLevel}` : '',
  ].filter(Boolean).join(' · ') || '尚未获得强化属性';
  artisanDetail.innerHTML = `
    <div class="artisan-detail-title tier-${selected.tier}${selected.equipped ? ' is-equipped' : ''}">
      <i data-lucide="${selected.type === 'weapon' ? 'sword' : 'shield'}" aria-hidden="true"></i>
      <span><small><span class="artisan-tier-copy">${equipmentTierLabel(selected.tier)} · ${selected.type === 'weapon' ? '武器' : '护甲'}</span>${selected.equipped ? '<b class="artisan-equipped-label">已装备</b>' : ''}</small><strong>${selected.name}</strong></span>
      ${equipmentScoreMarkup(selected.score, 'artisan-detail-score')}
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

function formatStatRange(range: { min: number; max: number }): string {
  return range.min === range.max ? String(range.min) : `${range.min}～${range.max}`;
}

function createBestiaryCard(creature: BestiaryCreature): HTMLElement {
  const card = document.createElement('article');
  card.className = `bestiary-card${creature.kind === 'boss' ? ' is-boss' : ''}`;
  const portrait = document.createElement('div');
  portrait.className = 'bestiary-portrait';
  const spriteScale = 3;
  portrait.style.backgroundImage = `url("${TINY_DUNGEON_SHEET}")`;
  portrait.style.backgroundSize = `${192 * spriteScale}px ${192 * spriteScale}px`;
  portrait.style.backgroundPosition = `${-(creature.frame % 12) * 16 * spriteScale}px ${-Math.floor(creature.frame / 12) * 16 * spriteScale}px`;
  portrait.style.borderColor = `#${creature.tint.toString(16).padStart(6, '0')}`;

  const copy = document.createElement('div');
  copy.className = 'bestiary-card-copy';
  copy.innerHTML = `
    <small>${creature.kind === 'boss' ? '区域首领' : '普通怪物'}</small>
    <strong>${creature.name}</strong>
    <dl>
      <div><dt>生命</dt><dd>${formatStatRange(creature.hp)}</dd></div>
      <div><dt>攻击</dt><dd>${formatStatRange(creature.attack)}</dd></div>
      <div><dt>防御</dt><dd>${formatStatRange(creature.defense)}</dd></div>
      <div><dt>古币</dt><dd>${formatStatRange(creature.reward)}</dd></div>
    </dl>
    ${creature.skillName ? `<p><b>${creature.skillName}</b><span>${creature.skillDescription}</span></p>` : ''}
  `;
  card.append(portrait, copy);
  return card;
}

function renderBestiary(state: UiState): void {
  const regions = state.bestiaryRegions;
  bestiaryModal.hidden = !regions;
  bestiaryRegions.replaceChildren();
  if (!regions) return;
  for (const region of regions) {
    const section = document.createElement('section');
    section.className = 'bestiary-region';
    const heading = document.createElement('div');
    heading.className = 'bestiary-region-heading';
    heading.innerHTML = `<span><small>第 ${region.index + 1} 区域</small><strong>${region.name}</strong></span><b>${region.floorLabel}</b>`;
    const grid = document.createElement('div');
    grid.className = 'bestiary-grid';
    for (const creature of [...region.enemies, region.boss]) grid.append(createBestiaryCard(creature));
    section.append(heading, grid);
    bestiaryRegions.append(section);
  }
}

function renderRegionMap(state: UiState): void {
  const options = state.regionOptions;
  regionMapModal.hidden = !options;
  regionMapOptions.replaceChildren();
  normalRegionModeButton.classList.toggle('is-selected', state.regionMapMode === 'normal');
  heroicRegionModeButton.classList.toggle('is-selected', state.regionMapMode === 'heroic');
  heroicRegionModeButton.disabled = !state.heroicUnlocked;
  heroicRegionModeButton.title = state.heroicUnlocked ? '英雄远征' : '击败第五区域首领后解锁';
  if (!options) return;

  for (const option of options) {
    const heroic = option.mode === 'heroic';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `region-map-option${heroic ? ' is-heroic' : ''}`;
    button.innerHTML = `
      <span class="map-thumbnail">
        <i data-lucide="${heroic ? 'swords' : 'map'}" aria-hidden="true"></i>
        <b>${String(option.index + 1).padStart(2, '0')}</b>
      </span>
      <span class="map-copy">
        <small>${heroic ? '英雄' : '普通'} · 第 ${option.index + 1} 区间</small>
        <strong>${option.name}</strong>
        <em>${option.startFloor}～${option.endFloor} 层${heroic ? ` · 威胁 ${option.difficultyStart}～${option.difficultyEnd}` : ''}</em>
      </span>
      <span class="map-start">${heroic ? '英雄 · ' : ''}第 ${option.startFloor} 层</span>
    `;
    button.addEventListener('click', () => sendCommand({
      action: 'start-region',
      regionIndex: option.index,
      mode: option.mode,
    }));
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
    merchantRevealPower.innerHTML = `${reveal.type === 'weapon' ? '武器 · 攻击' : '护甲 · 防御'} +${reveal.power}${equipmentScoreMarkup(reveal.score, 'compact-equipment-score')}`;
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
  logTitle.textContent = state.inTown ? '城镇纪事' : '洞窟回声';
  playerEffects.hidden = state.playerControlTurns <= 0 && state.playerBurnTurns <= 0;
  playerControlEffect.hidden = state.playerControlTurns <= 0;
  playerControlEffect.querySelector('b')!.textContent = `禁锢 · ${state.playerControlTurns} 回合`;
  playerBurnEffect.hidden = state.playerBurnTurns <= 0;
  playerBurnEffect.querySelector('b')!.textContent = `灼烧 · ${state.playerBurnTurns} 回合 · ${state.playerBurnDamage}/回合`;

  bossEncounter.hidden = !state.boss;
  bossExitModal.hidden = !state.bossExitChoice;
  if (state.boss) {
    bossName.textContent = state.boss.secondPhase ? `${state.boss.name} · 二阶段` : state.boss.name;
    bossEncounter.classList.toggle('is-second-phase', state.boss.secondPhase);
    bossEncounter.classList.toggle('is-healing', state.boss.healingTurns > 0);
    bossHp.textContent = `${state.boss.hp} / ${state.boss.maxHp}`;
    bossHealthFill.style.width = `${Math.max(0, (state.boss.hp / state.boss.maxHp) * 100)}%`;
    bossShield.hidden = state.boss.shield <= 0;
    bossShieldFill.style.width = `${Math.max(0, (state.boss.shield / Math.max(1, state.boss.maxShield)) * 100)}%`;
    bossShieldValue.textContent = `${state.boss.shield} / ${state.boss.maxShield}`;
    bossHealing.hidden = state.boss.healingTurns <= 0;
    bossHealingTurns.textContent = `${state.boss.healingTurns} 回合`;
    bossSkillWarning.hidden = !state.boss.chargingSkill;
    bossSkillName.textContent = state.boss.chargingSkill
      ? `${state.boss.chargingSkill} · ${state.boss.chargingTurns ?? 1} 回合后释放 · 躲开高亮格`
      : '';
  } else {
    bossEncounter.classList.remove('is-second-phase');
    bossEncounter.classList.remove('is-healing');
    bossShield.hidden = true;
    bossHealing.hidden = true;
    bossSkillWarning.hidden = true;
    bossSkillName.textContent = '';
  }

  renderGilding(state);
  renderTownLoadout(state);
  renderArtisan(state);
  renderBestiary(state);
  renderRegionMap(state);
  renderMerchant(state);
  renderDiscard(state);
  renderInventory(state.inventory, state.inventoryCapacity);
  renderPlayerSkills(state);
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
  escapeButton.disabled = state.status !== 'active' || !hasScroll || (state.isBossFloor && !state.canReturnToTown);
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

window.addEventListener(LOOT_ANIMATION_EVENT, (event) => {
  playPremiumLootAnimation((event as CustomEvent<LootAnimationDetail>).detail);
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
dismissBestiaryButton.addEventListener('click', () => sendCommand({ action: 'dismiss-bestiary' }));
dismissRegionMapButton.addEventListener('click', () => sendCommand({ action: 'dismiss-region-map' }));
normalRegionModeButton.addEventListener('click', () => sendCommand({ action: 'select-region-mode', mode: 'normal' }));
heroicRegionModeButton.addEventListener('click', () => sendCommand({ action: 'select-region-mode', mode: 'heroic' }));
dismissMerchantButton.addEventListener('click', () => sendCommand({ action: 'dismiss-merchant' }));
dismissDiscardButton.addEventListener('click', () => sendCommand({ action: 'dismiss-discard' }));
confirmDiscardButton.addEventListener('click', () => sendCommand({ action: 'confirm-discard' }));
dismissBossExitButton.addEventListener('click', () => sendCommand({ action: 'dismiss-boss-exit-choice' }));
bossExitReturnButton.addEventListener('click', () => sendCommand({ action: 'return-after-boss' }));
bossExitContinueButton.addEventListener('click', () => sendCommand({ action: 'continue-after-boss' }));
saveButton.addEventListener('click', openSaveManager);
dismissSaveButton.addEventListener('click', closeSaveManager);
exportSaveButton.addEventListener('click', exportSave);
importSaveButton.addEventListener('click', () => saveFileInput.click());
saveFileInput.addEventListener('change', () => {
  const file = saveFileInput.files?.[0];
  if (file) void importSave(file);
});

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
