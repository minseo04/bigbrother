import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from 'd3-force';
import type { Connection, Entity } from './intelligence';

export type GraphLayout = Record<string, [number, number]>;
// A dimension is any column of the table — a seeded profile field or an attribute
// someone added this morning. The caller supplies the reader.
export type Dimension = { key: string; label: string };
export type GroupHub = {
  id: string;
  key: string;
  label: string;
  position: [number, number];
  count: number;
  members: string[];
  primary: boolean;
};
export type GroupRoot = {
  id: string;
  key: string;
  label: string;
  position: [number, number];
  groups: number;
  primary: boolean;
};
export type GroupBridge = {
  id: string;
  source: string;
  target: string;
  shared: number;
};
export type GroupedLayout = {
  positions: GraphLayout;
  hubs: GroupHub[];
  roots: GroupRoot[];
  bridges: GroupBridge[];
};
type LayoutNode = SimulationNodeDatum & { id: string };
type LayoutLink = { source: string | LayoutNode; target: string | LayoutNode };
type ClusterNode = SimulationNodeDatum & {
  id: string;
  radius: number;
  entities: Entity[];
};

export function seedLayout(
  entities: Entity[],
  connections: Connection[],
): GraphLayout {
  const nodes: LayoutNode[] = entities.map((entity) => ({ id: entity.id }));
  const ids = new Set(nodes.map((node) => node.id));
  const links: LayoutLink[] = connections
    .filter((connection) => ids.has(connection.from) && ids.has(connection.to))
    .map((connection) => ({ source: connection.from, target: connection.to }));

  forceSimulation(nodes)
    .force(
      'link',
      forceLink<LayoutNode, LayoutLink>(links)
        .id((node) => node.id)
        .distance(180),
    )
    .force('charge', forceManyBody<LayoutNode>().strength(-800))
    .force('center', forceCenter(0, 0))
    .force('collide', forceCollide(90))
    .stop()
    .tick(400);

  return Object.fromEntries(
    nodes.map((node) => [
      node.id,
      [Math.round(node.x ?? 0), Math.round(node.y ?? 0)],
    ]),
  );
}
function stablePhase(value: string) {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return ((Math.abs(hash) % 360) * Math.PI) / 180;
}
export function hubId(key: string, label: string) {
  return 'group:' + key + ':' + label;
}
export function rootId(key: string) {
  return 'dimension:' + key;
}
function pile(
  entities: Entity[],
  key: string,
  valueOf: (entity: Entity, key: string) => string,
) {
  const grouped = new Map<string, Entity[]>();
  for (const entity of entities) {
    const value = valueOf(entity, key);
    grouped.set(value, [...(grouped.get(value) ?? []), entity]);
  }
  return [...grouped.entries()].sort(
    ([a, av], [b, bv]) => bv.length - av.length || a.localeCompare(b),
  );
}
// The primary dimension decides where every entity sits. Extra dimensions cannot
// also move them, so their hubs are laid out in bands under the field and joined to
// the piles they overlap — that overlap is the thing worth seeing.
export function groupedLayout(
  entities: Entity[],
  primary: Dimension,
  valueOf: (entity: Entity, key: string) => string,
  extras: Dimension[] = [],
): GroupedLayout {
  const clusters: ClusterNode[] = pile(entities, primary.key, valueOf).map(
    ([id, items], index) => ({
      id,
      entities: [...items].sort((a, b) => a.name.localeCompare(b.name)),
      radius: Math.max(260, 120 + Math.sqrt(items.length) * 92),
      x: Math.cos(index * 2.399963) * Math.sqrt(index) * 430,
      y: Math.sin(index * 2.399963) * Math.sqrt(index) * 330,
    }),
  );
  forceSimulation(clusters)
    .force('charge', forceManyBody<ClusterNode>().strength(-2200))
    .force('center', forceCenter(0, 0))
    .force(
      'collide',
      forceCollide(Math.max(...clusters.map((cluster) => cluster.radius), 260)),
    )
    .stop()
    .tick(360);

  const positions: GraphLayout = {};
  const hubs: GroupHub[] = clusters.map((cluster) => {
    const centerX = Math.round(cluster.x ?? 0);
    const centerY = Math.round(cluster.y ?? 0);
    const phase = stablePhase(cluster.id);
    cluster.entities.forEach((entity, index) => {
      const angle = phase + index * 2.399963;
      const radius = 145 + Math.sqrt(index) * 82 + (index % 3) * 9;
      positions[entity.id] = [
        Math.round(centerX + Math.cos(angle) * radius),
        Math.round(centerY + Math.sin(angle) * radius * 0.82),
      ];
    });
    return {
      id: hubId(primary.key, cluster.id),
      key: primary.key,
      label: cluster.id,
      position: [centerX, centerY] as [number, number],
      count: cluster.entities.length,
      members: cluster.entities.map((entity) => entity.id),
      primary: true,
    };
  });
  const xs = Object.values(positions).map(([x]) => x),
    ys = Object.values(positions).map(([, y]) => y),
    minX = Math.min(...xs, 0),
    maxX = Math.max(...xs, 0),
    minY = Math.min(...ys, 0),
    maxY = Math.max(...ys, 0),
    width = Math.max(maxX - minX, 900);
  const roots: GroupRoot[] = [
    {
      id: rootId(primary.key),
      key: primary.key,
      label: primary.label,
      position: [Math.round((minX + maxX) / 2), Math.round(minY - 460)],
      groups: hubs.length,
      primary: true,
    },
  ];
  extras.forEach((dimension, index) => {
    if (dimension.key === primary.key) return;
    const piles = pile(entities, dimension.key, valueOf);
    const band = Math.round(maxY + 420 + index * 340);
    const step = width / Math.max(piles.length, 1);
    piles.forEach(([label, items], slot) => {
      hubs.push({
        id: hubId(dimension.key, label),
        key: dimension.key,
        label,
        position: [Math.round(minX + step * (slot + 0.5)), band],
        count: items.length,
        members: items.map((entity) => entity.id),
        primary: false,
      });
    });
    roots.push({
      id: rootId(dimension.key),
      key: dimension.key,
      label: dimension.label,
      position: [Math.round(minX - 480), band],
      groups: piles.length,
      primary: false,
    });
  });
  // Two piles from different dimensions are joined when they hold the same entities.
  const bridges: GroupBridge[] = [];
  for (let a = 0; a < hubs.length; a += 1) {
    for (let b = a + 1; b < hubs.length; b += 1) {
      const one = hubs[a]!,
        other = hubs[b]!;
      if (one.key === other.key) continue;
      const members = new Set(one.members);
      const shared = other.members.filter((id) => members.has(id)).length;
      if (!shared) continue;
      bridges.push({
        id: 'bridge:' + one.id + '|' + other.id,
        source: one.id,
        target: other.id,
        shared,
      });
    }
  }
  return { positions, hubs, roots, bridges };
}
