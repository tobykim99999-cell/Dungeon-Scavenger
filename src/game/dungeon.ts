export const MAP_WIDTH = 28;
export const MAP_HEIGHT = 20;

export type Tile = 0 | 1;

export interface Point {
  x: number;
  y: number;
}

export interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
  center: Point;
}

export interface Dungeon {
  tiles: Tile[][];
  rooms: Room[];
  start: Point;
  exit: Point;
  seed: number;
}

export interface RandomSource {
  next: () => number;
  integer: (min: number, max: number) => number;
}

export function createRandom(seed: number): RandomSource {
  let state = seed >>> 0;

  const next = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    integer: (min, max) => Math.floor(next() * (max - min + 1)) + min,
  };
}

function roomsOverlap(a: Room, b: Room): boolean {
  return !(
    a.x + a.width + 1 < b.x ||
    b.x + b.width + 1 < a.x ||
    a.y + a.height + 1 < b.y ||
    b.y + b.height + 1 < a.y
  );
}

function carveRoom(tiles: Tile[][], room: Room): void {
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      tiles[y][x] = 1;
    }
  }
}

function carveHorizontal(tiles: Tile[][], fromX: number, toX: number, y: number): void {
  const start = Math.min(fromX, toX);
  const end = Math.max(fromX, toX);
  for (let x = start; x <= end; x += 1) tiles[y][x] = 1;
}

function carveVertical(tiles: Tile[][], fromY: number, toY: number, x: number): void {
  const start = Math.min(fromY, toY);
  const end = Math.max(fromY, toY);
  for (let y = start; y <= end; y += 1) tiles[y][x] = 1;
}

function connectRooms(tiles: Tile[][], a: Point, b: Point, random: RandomSource): void {
  if (random.next() < 0.5) {
    carveHorizontal(tiles, a.x, b.x, a.y);
    carveVertical(tiles, a.y, b.y, b.x);
    return;
  }

  carveVertical(tiles, a.y, b.y, a.x);
  carveHorizontal(tiles, a.x, b.x, b.y);
}

function squaredDistance(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

export function generateDungeon(seed: number): Dungeon {
  const random = createRandom(seed);
  const tiles = Array.from({ length: MAP_HEIGHT }, () =>
    Array.from({ length: MAP_WIDTH }, () => 0 as Tile),
  );
  const rooms: Room[] = [];

  for (let attempt = 0; attempt < 180 && rooms.length < 10; attempt += 1) {
    const width = random.integer(4, 8);
    const height = random.integer(4, 6);
    const x = random.integer(2, MAP_WIDTH - width - 3);
    const y = random.integer(2, MAP_HEIGHT - height - 3);
    const room: Room = {
      x,
      y,
      width,
      height,
      center: {
        x: x + Math.floor(width / 2),
        y: y + Math.floor(height / 2),
      },
    };

    if (rooms.some((existing) => roomsOverlap(existing, room))) continue;

    carveRoom(tiles, room);
    if (rooms.length > 0) {
      connectRooms(tiles, rooms[rooms.length - 1].center, room.center, random);
    }
    rooms.push(room);
  }

  if (rooms.length < 2) {
    throw new Error(`Unable to generate a usable dungeon for seed ${seed}`);
  }

  const start = rooms[0].center;
  const exitRoom = rooms.reduce((farthest, room) =>
    squaredDistance(start, room.center) > squaredDistance(start, farthest.center) ? room : farthest,
  );

  return {
    tiles,
    rooms,
    start: { ...start },
    exit: { ...exitRoom.center },
    seed,
  };
}

export function generateBossArena(seed: number): Dungeon {
  const tiles = Array.from({ length: MAP_HEIGHT }, () =>
    Array.from({ length: MAP_WIDTH }, () => 0 as Tile),
  );
  const room: Room = {
    x: 2,
    y: 2,
    width: MAP_WIDTH - 4,
    height: MAP_HEIGHT - 4,
    center: { x: Math.floor(MAP_WIDTH / 2), y: Math.floor(MAP_HEIGHT / 2) },
  };
  carveRoom(tiles, room);

  return {
    tiles,
    rooms: [room],
    start: { x: room.center.x, y: room.y + room.height - 3 },
    exit: { x: room.center.x, y: room.y + 4 },
    seed,
  };
}

export function generateTownMap(): Dungeon {
  const tiles = Array.from({ length: MAP_HEIGHT }, () =>
    Array.from({ length: MAP_WIDTH }, () => 0 as Tile),
  );
  const room: Room = {
    x: 5,
    y: 4,
    width: 18,
    height: 12,
    center: { x: 14, y: 10 },
  };
  carveRoom(tiles, room);

  return {
    tiles,
    rooms: [room],
    start: { x: 14, y: 13 },
    exit: { x: 14, y: 5 },
    seed: 0,
  };
}

export function isWalkable(tiles: Tile[][], point: Point): boolean {
  return Boolean(tiles[point.y]?.[point.x]);
}

export function collectWalkableTiles(dungeon: Dungeon): Point[] {
  const result: Point[] = [];
  for (let y = 0; y < dungeon.tiles.length; y += 1) {
    for (let x = 0; x < dungeon.tiles[y].length; x += 1) {
      if (dungeon.tiles[y][x] === 1) result.push({ x, y });
    }
  }
  return result;
}

export function hasPath(tiles: Tile[][], start: Point, target: Point): boolean {
  return (start.x === target.x && start.y === target.y) || findPath(tiles, start, target).length > 0;
}

export function findPath(
  tiles: Tile[][],
  start: Point,
  target: Point,
  blocked: ReadonlySet<string> = new Set(),
): Point[] {
  if (!isWalkable(tiles, start) || !isWalkable(tiles, target)) return [];
  if (start.x === target.x && start.y === target.y) return [];

  const queue: Point[] = [{ ...start }];
  const visited = new Set([`${start.x},${start.y}`]);
  const previous = new Map<string, Point>();
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];

    for (const direction of directions) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const key = `${next.x},${next.y}`;
      if (!visited.has(key) && !blocked.has(key) && isWalkable(tiles, next)) {
        visited.add(key);
        previous.set(key, current);
        if (next.x === target.x && next.y === target.y) {
          const path: Point[] = [next];
          let cursor = current;
          while (cursor.x !== start.x || cursor.y !== start.y) {
            path.push(cursor);
            cursor = previous.get(`${cursor.x},${cursor.y}`)!;
          }
          return path.reverse();
        }
        queue.push(next);
      }
    }
  }

  return [];
}

export function findPathToAdjacent(
  tiles: Tile[][],
  start: Point,
  target: Point,
  blocked: ReadonlySet<string> = new Set(),
): Point[] {
  const candidates = [
    { x: target.x + 1, y: target.y },
    { x: target.x - 1, y: target.y },
    { x: target.x, y: target.y + 1 },
    { x: target.x, y: target.y - 1 },
  ].filter((point) => isWalkable(tiles, point) && !blocked.has(`${point.x},${point.y}`));

  let shortest: Point[] = [];
  for (const candidate of candidates) {
    const path = findPath(tiles, start, candidate, blocked);
    if (path.length > 0 && (shortest.length === 0 || path.length < shortest.length)) shortest = path;
  }
  return shortest;
}
