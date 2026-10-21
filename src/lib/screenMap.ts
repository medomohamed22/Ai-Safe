import type { ScreenProject } from './screens';

export interface MapPoint { x: number; y: number }

export const MAP_CARD_W = 300;
export const MAP_CARD_H = 250;
const GAP_X = 130;
const GAP_Y = 70;

// Auto-layout for the screen map: breadth-first columns that follow the
// navigation links from the first screen; screens no link reaches are
// stacked in one trailing column.
export function layoutScreens(project: ScreenProject): Record<string, MapPoint> {
  const positions: Record<string, MapPoint> = {};
  if (!project.screens.length) return positions;
  const known = new Set(project.screens.map(s => s.id));
  const depth = new Map<string, number>();
  const start = project.screens[0].id;
  depth.set(start, 0);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift()!;
    const d = depth.get(id)!;
    for (const link of project.links) {
      if (link.from === id && known.has(link.to) && !depth.has(link.to)) {
        depth.set(link.to, d + 1);
        queue.push(link.to);
      }
    }
  }
  let maxDepth = 0;
  for (const d of depth.values()) maxDepth = Math.max(maxDepth, d);
  for (const s of project.screens) if (!depth.has(s.id)) depth.set(s.id, maxDepth + 1);
  const rows = new Map<number, number>();
  for (const s of project.screens) {
    const d = depth.get(s.id)!;
    const row = rows.get(d) || 0;
    rows.set(d, row + 1);
    positions[s.id] = { x: d * (MAP_CARD_W + GAP_X), y: row * (MAP_CARD_H + GAP_Y) };
  }
  return positions;
}

// Saved drag positions win; anything missing falls back to the auto-layout.
export function resolvePositions(project: ScreenProject): Record<string, MapPoint> {
  const layout = layoutScreens(project);
  const out: Record<string, MapPoint> = {};
  for (const s of project.screens) out[s.id] = project.mapPositions?.[s.id] || layout[s.id];
  return out;
}

export function mapBounds(positions: Record<string, MapPoint>) {
  const pts = Object.values(positions);
  if (!pts.length) return { minX: 0, minY: 0, maxX: MAP_CARD_W, maxY: MAP_CARD_H };
  return {
    minX: Math.min(...pts.map(p => p.x)),
    minY: Math.min(...pts.map(p => p.y)),
    maxX: Math.max(...pts.map(p => p.x + MAP_CARD_W)),
    maxY: Math.max(...pts.map(p => p.y + MAP_CARD_H)),
  };
}
// Flow order for the numbered badges: breadth-first visit order from the
// first screen along the navigation links; screens no link reaches follow
// in list order.
export function flowOrder(project: ScreenProject): Record<string, number> {
  const order: Record<string, number> = {};
  if (!project.screens.length) return order;
  const known = new Set(project.screens.map(s => s.id));
  const seen = new Set<string>([project.screens[0].id]);
  const queue = [project.screens[0].id];
  let n = 0;
  while (queue.length) {
    const id = queue.shift()!;
    order[id] = n++;
    for (const link of project.links) {
      if (link.from === id && known.has(link.to) && !seen.has(link.to)) {
        seen.add(link.to);
        queue.push(link.to);
      }
    }
  }
  for (const s of project.screens) if (!(s.id in order)) order[s.id] = n++;
  return order;
}
