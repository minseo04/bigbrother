'use client';
/* eslint-disable next/no-img-element -- entity images are arbitrary URLs from the shared workspace. */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GraphHoverCard, type HoverTarget } from '@/components/graph-hovercard';
import type { Connection, Entity } from '@/lib/intelligence';
type SharedFlowNode = Node<
  { entity: Entity; degree: number; notes: number; scale: number },
  'shared'
>;
type SharedFlowEdge = Edge<{ connection: Connection }>;
type Props = {
  entities: Entity[];
  connections: Connection[];
  layout: Record<string, [number, number]>;
  noteCounts: Record<string, number>;
  board: {
    pattern: string;
    patternColor: string;
    surface: string;
    gap: number;
    nodeScale: number;
  };
  selectedId: string;
  onEntity: (entity: Entity) => void;
  onConnection: (connection: Connection) => void;
};
function SharedNode({ data, selected }: NodeProps<SharedFlowNode>) {
  const size = Math.round(
    (44 + Math.min(data.degree, 6) * 4) * (data.scale / 100),
  );
  return (
    <div
      className={
        'flow-entity-node shared-node' + (selected ? ' is-selected' : '')
      }
      style={
        {
          '--entity-color': data.entity.color,
          '--node-size': size + 'px',
        } as CSSProperties
      }
    >
      <Handle type="target" position={Position.Left} />
      <span className="node-initials">
        {data.entity.image ? (
          <img src={data.entity.image} alt="" />
        ) : (
          data.entity.initials
        )}
      </span>
      <span className="node-label">{data.entity.name}</span>
      <span className="node-metrics">
        <span>{data.degree} links</span>
        {data.notes > 0 && <span>{data.notes} notes</span>}
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { shared: SharedNode };
function SharedCanvas({
  entities,
  connections,
  layout,
  noteCounts,
  board,
  selectedId,
  onEntity,
  onConnection,
}: Props) {
  const canvas = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const entityMap = useMemo(
    () => new Map(entities.map((entity) => [entity.id, entity])),
    [entities],
  );
  const degree = useMemo(
    () =>
      Object.fromEntries(
        entities.map((entity) => [
          entity.id,
          connections.filter(
            (connection) =>
              connection.from === entity.id || connection.to === entity.id,
          ).length,
        ]),
      ),
    [entities, connections],
  );
  const nodes = useMemo<SharedFlowNode[]>(
    () =>
      entities.map((entity) => ({
        id: entity.id,
        type: 'shared',
        position: {
          x: layout[entity.id]?.[0] ?? 0,
          y: layout[entity.id]?.[1] ?? 0,
        },
        draggable: false,
        connectable: false,
        selected: entity.id === selectedId,
        data: {
          entity,
          degree: degree[entity.id] ?? 0,
          notes: noteCounts[entity.id] ?? 0,
          scale: board.nodeScale || 100,
        },
        ariaLabel: entity.name,
      })),
    [entities, layout, degree, noteCounts, board.nodeScale, selectedId],
  );
  const edges = useMemo<SharedFlowEdge[]>(
    () =>
      connections.map((connection) => ({
        id: connection.id,
        source: connection.from,
        target: connection.to,
        selected: connection.id === selectedId,
        interactionWidth: 20,
        data: { connection },
        style: {
          stroke:
            connection.id === selectedId
              ? 'var(--accent)'
              : 'var(--border-strong)',
          strokeWidth: connection.id === selectedId ? 2.5 : 1.5,
          strokeDasharray:
            connection.status === 'Hypothesis' ? '6 5' : undefined,
        },
      })),
    [connections, selectedId],
  );
  const pointAt = useCallback((event: { clientX: number; clientY: number }) => {
    const box = canvas.current?.getBoundingClientRect();
    return {
      x: event.clientX - (box?.left ?? 0),
      y: event.clientY - (box?.top ?? 0),
    };
  }, []);
  const hoverNode = useCallback(
    (event: { clientX: number; clientY: number }, node: SharedFlowNode) =>
      setHover({
        kind: 'entity',
        ...pointAt(event),
        entity: node.data.entity,
        degree: node.data.degree,
        notes: node.data.notes,
      }),
    [pointAt],
  );
  const hoverEdge = useCallback(
    (event: { clientX: number; clientY: number }, edge: SharedFlowEdge) => {
      const connection = edge.data?.connection;
      if (!connection) return setHover(null);
      setHover({
        kind: 'connection',
        ...pointAt(event),
        connection,
        from: entityMap.get(connection.from),
        to: entityMap.get(connection.to),
      });
    },
    [entityMap, pointAt],
  );
  return (
    <div
      className="shared-canvas flow-graph"
      ref={canvas}
      style={{ '--board-surface': board.surface } as CSSProperties}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onEntity(node.data.entity)}
        onEdgeClick={(_, edge) => {
          if (edge.data?.connection) onConnection(edge.data.connection);
        }}
        onNodeMouseEnter={hoverNode}
        onNodeMouseMove={hoverNode}
        onNodeMouseLeave={() => setHover(null)}
        onEdgeMouseEnter={hoverEdge}
        onEdgeMouseMove={hoverEdge}
        onEdgeMouseLeave={() => setHover(null)}
        onMoveStart={() => setHover(null)}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnDoubleClick={false}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
      >
        {board.pattern !== 'none' && (
          <Background
            variant={
              board.pattern === 'lines'
                ? BackgroundVariant.Lines
                : board.pattern === 'cross'
                  ? BackgroundVariant.Cross
                  : BackgroundVariant.Dots
            }
            gap={board.gap || 22}
            size={1}
            color={board.patternColor}
          />
        )}
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) =>
            (node.data as SharedFlowNode['data']).entity.color
          }
        />
      </ReactFlow>
      <GraphHoverCard target={hover} />
    </div>
  );
}
export function SharedMap(props: Props) {
  return (
    <ReactFlowProvider>
      <SharedCanvas {...props} />
    </ReactFlowProvider>
  );
}
