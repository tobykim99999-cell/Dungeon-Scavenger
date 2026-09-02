import type { Item } from './types';

export function itemQuantity(item: Item): number {
  return Math.max(1, Math.floor(item.quantity ?? 1));
}

export function canStackItems(existing: Item, incoming: Item): boolean {
  const samePotion = (
    existing.type === 'potion' &&
    incoming.type === 'potion' &&
    existing.name === incoming.name &&
    existing.power === incoming.power &&
    existing.rarity === incoming.rarity
  );
  const sameMaterial = (
    existing.type === 'material' &&
    incoming.type === 'material' &&
    existing.name === incoming.name &&
    existing.materialRegion === incoming.materialRegion &&
    Boolean(existing.gilded) === Boolean(incoming.gilded)
  );
  return samePotion || sameMaterial;
}
