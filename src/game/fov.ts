import type { Point, Tile } from './dungeon';

const keyFor = (x: number, y: number) => `${x},${y}`;

function hasLineOfSight(tiles: Tile[][], origin: Point, target: Point): boolean {
  let x = origin.x;
  let y = origin.y;
  const dx = Math.abs(target.x - origin.x);
  const dy = Math.abs(target.y - origin.y);
  const stepX = origin.x < target.x ? 1 : -1;
  const stepY = origin.y < target.y ? 1 : -1;
  let error = dx - dy;

  while (x !== target.x || y !== target.y) {
    const doubled = error * 2;
    if (doubled > -dy) {
      error -= dy;
      x += stepX;
    }
    if (doubled < dx) {
      error += dx;
      y += stepY;
    }

    if (x === target.x && y === target.y) return true;
    if (tiles[y]?.[x] === 0) return false;
  }

  return true;
}

export function computeFieldOfView(tiles: Tile[][], origin: Point, radius: number): Set<string> {
  const visible = new Set<string>();

  for (let y = origin.y - radius; y <= origin.y + radius; y += 1) {
    for (let x = origin.x - radius; x <= origin.x + radius; x += 1) {
      if (!tiles[y]?.[x] && tiles[y]?.[x] !== 0) continue;
      if ((x - origin.x) ** 2 + (y - origin.y) ** 2 > radius ** 2) continue;
      if (hasLineOfSight(tiles, origin, { x, y })) visible.add(keyFor(x, y));
    }
  }

  return visible;
}
