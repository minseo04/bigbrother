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
export type GroupDimension = 'vertical' | 'hq' | 'layer' | 'stage';

type LayoutNode = SimulationNodeDatum & { id: string };
type LayoutLink = { source: string | LayoutNode; target: string | LayoutNode };
type ClusterNode = SimulationNodeDatum & {
  id: string;
  radius: number;
  entities: Entity[];
};

export type GroupedLayout = {
  positions: GraphLayout;
  hubs: Array<{
    id: string;
    label: string;
    position: [number, number];
    count: number;
  }>;
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

export function groupValue(entity: Entity, dimension: GroupDimension) {
  const profile = entity.profile;
  if (!profile) return 'Other';
  if (dimension === 'hq') {
    const city = profile.hq.split(/\s*[,/]\s*/)[0]?.trim();
    return city || profile.hq;
  }
  if (dimension === 'layer') return profile.layer;
  if (dimension === 'stage') return profile.stage;
  return profile.vertical;
}

function stablePhase(value: string) {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return ((Math.abs(hash) % 360) * Math.PI) / 180;
}

export function groupedLayout(
  entities: Entity[],
  dimension: GroupDimension,
): GroupedLayout {
  const grouped = new Map<string, Entity[]>();
  for (const entity of entities) {
    const key = groupValue(entity, dimension);
    grouped.set(key, [...(grouped.get(key) ?? []), entity]);
  }

  const clusters: ClusterNode[] = [...grouped.entries()]
    .sort(([a, av], [b, bv]) => bv.length - av.length || a.localeCompare(b))
    .map(([id, items], index) => ({
      id,
      entities: [...items].sort((a, b) => a.name.localeCompare(b.name)),
      radius: Math.max(260, 120 + Math.sqrt(items.length) * 92),
      x: Math.cos(index * 2.399963) * Math.sqrt(index) * 430,
      y: Math.sin(index * 2.399963) * Math.sqrt(index) * 330,
    }));

  forceSimulation(clusters)
    .force('charge', forceManyBody<ClusterNode>().strength(-2200))
    .force('center', forceCenter(0, 0))
    .force(
      'collide',
      forceCollide(Math.max(...clusters.map((cluster) => cluster.radius))),
    )
    .stop()
    .tick(360);

  const positions: GraphLayout = {};
  const hubs = clusters.map((cluster) => {
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
      id: `group:${dimension}:${cluster.id}`,
      label: cluster.id,
      position: [centerX, centerY] as [number, number],
      count: cluster.entities.length,
    };
  });

  return { positions, hubs };
}

export function groupLayout(
  entities: Entity[],
  dimension: GroupDimension,
): GraphLayout {
  return groupedLayout(entities, dimension).positions;
}
