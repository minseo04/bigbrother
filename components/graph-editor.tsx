'use client';
/* eslint-disable next/no-img-element -- images are arbitrary URLs the user pastes; next/image needs a domain allowlist, and linking any source is the point. */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection as FlowConnection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Layers } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  groupedLayout,
  type GraphLayout,
  type GroupBridge,
  type GroupHub,
  type GroupRoot,
} from '@/lib/graph-layout';
import { groupOf, type Row, type Table } from '@/lib/dataframe';
import { GraphHoverCard, type HoverTarget } from '@/components/graph-hovercard';
import { TimelineScrubber } from '@/components/graph-timeline';
import { timelineIsUseful } from '@/lib/timeline';
import { useGraphStore } from '@/lib/graph-store';
import { activeBoard, useBoardStore } from '@/lib/board-store';
import { useWorkspaceStore } from '@/lib/workspace-store';
import type { Connection, Entity } from '@/lib/intelligence';
type EntityFlowNode = Node<
  {
    entity: Entity;
    degree: number;
    notes: number;
    scale: number;
    dimmed: boolean;
    groupLabel: string;
    onToggleFollow: (entity: Entity) => void;
    onConnectFrom: (id: string) => void;
    onInspect: (entity: Entity) => void;
  },
  'entity'
>;
type HubFlowNode = Node<
  {
    hub: GroupHub;
    dimension: string;
    color: string;
    onInspect: (hub: GroupHub) => void;
  },
  'hub'
>;
type RootFlowNode = Node<{ root: GroupRoot; color: string }, 'root'>;
type GraphFlowNode = EntityFlowNode | HubFlowNode | RootFlowNode;
type ConnectionFlowEdge = Edge<
  {
    connection?: Connection;
    draft?: boolean;
    group?: 'member' | 'root' | 'bridge';
    color?: string;
    dash?: string;
    shared?: number;
    onInspect?: () => void;
  },
  'connection'
>;
export type GroupSelection = {
  label: string;
  dimension: string;
  count: number;
  members: string[];
};
type Props = {
  entities: Entity[];
  connections: Connection[];
  table: Table;
  onGroup: (group: GroupSelection | null) => void;
  full?: boolean;
  onEntity: (entity: Entity) => void;
  onConnection: (connection: Connection) => void;
  onToggleFollow: (entity: Entity) => void;
  onConnectPair: (source: string, target: string) => void;
  onConnectFrom: (source: string, target?: string) => void;
  onNewEntity: (position: [number, number]) => void;
};
function EntityNode({ data, selected }: NodeProps<EntityFlowNode>) {
  const size = Math.round(
    (44 + Math.min(data.degree, 6) * 4) * (data.scale / 100),
  );
  return (
    <ContextMenu>
      <ContextMenuTrigger
        tabIndex={0}
        aria-label={'Actions for ' + data.entity.name}
        className={'flow-entity-node' + (selected ? ' is-selected' : '')}
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
        <span className="node-group-label">{data.groupLabel}</span>
        <span className="node-label">{data.entity.name}</span>
        <span className="node-metrics">
          <span aria-label={data.degree + ' connections'}>
            {data.degree} links
          </span>
          <span aria-label={data.notes + ' notes'}>{data.notes} notes</span>
        </span>
        <button
          type="button"
          className="node-follow nodrag nowheel"
          onClick={(event) => {
            event.stopPropagation();
            data.onToggleFollow(data.entity);
          }}
          tabIndex={data.dimmed ? -1 : 0}
        >
          {data.entity.followed ? 'Following' : 'Follow'}
        </button>
        <Handle type="source" position={Position.Right} />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuGroup>
          <ContextMenuLabel>{data.entity.name}</ContextMenuLabel>
          <ContextMenuItem onClick={() => data.onToggleFollow(data.entity)}>
            {data.entity.followed ? 'Unfollow' : 'Follow'}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              data.onInspect(data.entity);
              setTimeout(() =>
                document
                  .querySelector<HTMLTextAreaElement>(
                    '.shell-inspector textarea',
                  )
                  ?.focus(),
              );
            }}
          >
            Add note
          </ContextMenuItem>
          <ContextMenuItem onClick={() => data.onConnectFrom(data.entity.id)}>
            Add connection
          </ContextMenuItem>
          {data.entity.source && (
            <ContextMenuItem
              onClick={() =>
                window.open(data.entity.source, '_blank', 'noopener')
              }
            >
              Open source
            </ContextMenuItem>
          )}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
// Dimensions are chosen at runtime, so their colours are assigned in the order the
// viewer turned them on rather than baked in per field.
const dimensionPalette = [
  { color: 'var(--success)', dash: '2 7' },
  { color: 'var(--warning)', dash: '8 6' },
  { color: 'var(--entity-company)', dash: '10 4 2 4' },
  { color: 'var(--entity-government)', dash: '14 7' },
];
function GroupHubNode({ data, selected }: NodeProps<HubFlowNode>) {
  return (
    <button
      type="button"
      className={
        'location-hub-node' +
        (data.hub.primary ? '' : ' is-secondary') +
        (selected ? ' is-selected' : '')
      }
      style={{ '--group-color': data.color } as CSSProperties}
      aria-label={`${data.hub.label}, ${data.hub.count} in ${data.dimension}`}
      onClick={() => data.onInspect(data.hub)}
    >
      <Handle type="target" position={Position.Left} />
      <span>{data.dimension}</span>
      <strong>{data.hub.label}</strong>
      <small>{data.hub.count} entities</small>
      <Handle type="source" position={Position.Right} />
    </button>
  );
}
function GroupRootNode({ data }: NodeProps<RootFlowNode>) {
  return (
    <div
      className="group-root-node"
      style={{ '--group-color': data.color } as CSSProperties}
      aria-label={`Grouped by ${data.root.label}`}
    >
      <Handle type="target" position={Position.Left} />
      <span>GROUPED BY</span>
      <strong>{data.root.label}</strong>
      <small>{data.root.groups} groups</small>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
function ConnectionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
  markerEnd,
  markerStart,
  style,
}: EdgeProps<ConnectionFlowEdge>) {
  const [path] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    }),
    connection = data?.connection,
    group = data?.group,
    groupStyle = group
      ? { color: data?.color ?? 'var(--border-strong)', dash: data?.dash }
      : null;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={20}
        style={{
          ...style,
          stroke: groupStyle
            ? groupStyle.color
            : selected
              ? 'var(--accent)'
              : 'var(--border-strong)',
          strokeOpacity: groupStyle ? (group === 'bridge' ? 0.6 : 0.42) : 1,
          strokeWidth: groupStyle
            ? group === 'bridge'
              ? Math.min(4, 0.8 + (data?.shared ?? 1) * 0.5)
              : group === 'root'
                ? 1.6
                : 1.2
            : selected
              ? 2.5
              : 1.5,
          strokeDasharray: groupStyle
            ? groupStyle.dash
            : connection?.status === 'Hypothesis'
              ? '6 5'
              : data?.draft
                ? '3 4'
                : undefined,
        }}
      />
      {connection && (
        <EdgeLabelRenderer>
          <ContextMenu>
            <ContextMenuTrigger
              tabIndex={0}
              className="edge-context-target"
              style={{
                transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px,${(sourceY + targetY) / 2}px)`,
              }}
              aria-label={'Actions for ' + connection.label}
            />
            <ContextMenuContent>
              <ContextMenuGroup>
                <ContextMenuLabel>{connection.label}</ContextMenuLabel>
                <ContextMenuItem
                  onClick={() => {
                    data?.onInspect?.();
                    setTimeout(() =>
                      document
                        .querySelector<HTMLTextAreaElement>(
                          '.shell-inspector textarea',
                        )
                        ?.focus(),
                    );
                  }}
                >
                  Add note
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() =>
                    window.open(connection.url, '_blank', 'noopener')
                  }
                >
                  Open source
                </ContextMenuItem>
              </ContextMenuGroup>
            </ContextMenuContent>
          </ContextMenu>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
const nodeTypes = {
  entity: EntityNode,
  hub: GroupHubNode,
  root: GroupRootNode,
};
const edgeTypes = { connection: ConnectionEdge };
const TODAY = new Date().toISOString().slice(0, 10);
function validLayout(value: unknown): GraphLayout {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: GraphLayout = {};
  for (const [id, position] of Object.entries(value)) {
    if (
      Array.isArray(position) &&
      position.length === 2 &&
      position.every((n) => typeof n === 'number' && Number.isFinite(n))
    )
      result[id] = [position[0], position[1]];
  }
  return result;
}
function GraphCanvas({
  entities,
  connections,
  table,
  onGroup,
  full,
  onEntity,
  onConnection,
  onToggleFollow,
  onConnectPair,
  onConnectFrom,
  onNewEntity,
}: Props) {
  const board = useBoardStore(activeBoard),
    boardId = board?.id ?? '';
  const positions = useGraphStore((state) => state.positions),
    draftEdges = useGraphStore((state) => state.draftEdges),
    replacePositions = useGraphStore((state) => state.replacePositions),
    moveNode = useGraphStore((state) => state.moveNode),
    addDraftEdge = useGraphStore((state) => state.addDraftEdge),
    clearDraftEdges = useGraphStore((state) => state.clearDraftEdges),
    selectedEntityIds = useWorkspaceStore((state) => state.selectedEntityIds),
    selectedConnectionId = useWorkspaceStore(
      (state) => state.selectedConnectionId,
    ),
    mode = useWorkspaceStore((state) => state.mode),
    setMode = useWorkspaceStore((state) => state.setMode);
  const canvas = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [ready, setReady] = useState(false),
    [noteCounts, setNoteCounts] = useState<Record<string, number>>({}),
    [asOf, setAsOf] = useState(TODAY),
    [groupBy, setGroupBy] = useState('vertical'),
    [extraKeys, setExtraKeys] = useState<string[]>([]),
    [groupHubs, setGroupHubs] = useState<GroupHub[]>([]),
    [groupRoots, setGroupRoots] = useState<GroupRoot[]>([]),
    [groupBridges, setGroupBridges] = useState<GroupBridge[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flow = useReactFlow<GraphFlowNode, ConnectionFlowEdge>();
  const [viewport] = useState<Viewport>(() => {
    try {
      const saved = localStorage.getItem('graph-viewport');
      if (saved) {
        const value = JSON.parse(saved) as Partial<Viewport>;
        if (
          typeof value.x === 'number' &&
          typeof value.y === 'number' &&
          typeof value.zoom === 'number'
        )
          return { x: value.x, y: value.y, zoom: value.zoom };
      }
    } catch {}
    return { x: 0, y: 0, zoom: 1 };
  });
  const entitiesRef = useRef(entities),
    connectionsRef = useRef(connections),
    toggleFollowRef = useRef(onToggleFollow);
  useEffect(() => {
    entitiesRef.current = entities;
    connectionsRef.current = connections;
    toggleFollowRef.current = onToggleFollow;
  }, [entities, connections, onToggleFollow]);
  const graphKey =
    entities.map((entity) => entity.id).join('|') +
    '::' +
    connections.map((connection) => connection.id).join('|');
  const timelineFrom = useMemo(
      () =>
        connections
          .map((connection) => connection.date)
          .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= TODAY)
          .sort()[0] ?? TODAY,
      [connections],
    ),
    showTimeline = timelineIsUseful(timelineFrom, TODAY, Boolean(full)),
    atToday = asOf === TODAY,
    timelineVisibility = useMemo(() => {
      const connectionIds = new Set(
          connections
            .filter((connection) => connection.date <= asOf)
            .map((connection) => connection.id),
        ),
        entityIds = new Set(
          connections
            .filter((connection) => connectionIds.has(connection.id))
            .flatMap((connection) => [connection.from, connection.to]),
        );
      return { connectionIds, entityIds };
    }, [connections, asOf]),
    visibleConnectionIds = timelineVisibility.connectionIds,
    visibleEntityIds = timelineVisibility.entityIds;
  const toggleFollow = useCallback(
    (entity: Entity) => toggleFollowRef.current(entity),
    [],
  );
  const entityMap = useMemo(
    () => new Map(entities.map((entity) => [entity.id, entity])),
    [entities],
  );
  // Any column of the table can group the map, so the picker is built from the data
  // rather than from a fixed list of market fields.
  const rowById = useMemo(
    () => new Map(table.rows.map((row) => [row.id, row] as [string, Row])),
    [table.rows],
  );
  const groupColumns = useMemo(
    () => table.columns.filter((column) => column.groupable),
    [table.columns],
  );
  const columnLabel = useCallback(
    (key: string) =>
      table.columns.find((column) => column.key === key)?.label ?? key,
    [table.columns],
  );
  const valueOf = useCallback(
    (entity: Entity, key: string) => {
      const row = rowById.get(entity.id);
      return row ? groupOf(row, key) : 'Not recorded';
    },
    [rowById],
  );
  const activeKeys = useMemo(
    () => [groupBy, ...extraKeys.filter((key) => key !== groupBy)],
    [groupBy, extraKeys],
  );
  const dimensionStyles = useMemo(
    () =>
      new Map(
        activeKeys.map((key, index) => [
          key,
          dimensionPalette[index % dimensionPalette.length]!,
        ]),
      ),
    [activeKeys],
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
  const makeNodes = useCallback(
    (layout: GraphLayout): GraphFlowNode[] => {
      const entityNodes: EntityFlowNode[] = entities
        .filter((entity) => layout[entity.id] !== undefined)
        .map((entity) => ({
          id: entity.id,
          type: 'entity',
          position: {
            x: layout[entity.id]?.[0] ?? 0,
            y: layout[entity.id]?.[1] ?? 0,
          },
          data: {
            entity,
            degree: degree[entity.id] ?? 0,
            notes: noteCounts[entity.id] ?? 0,
            scale: board?.nodeScale ?? 100,
            dimmed: !atToday && !visibleEntityIds.has(entity.id),
            groupLabel: valueOf(entity, groupBy),
            onToggleFollow: toggleFollow,
            onConnectFrom,
            onInspect: onEntity,
          },
          ariaLabel: 'Inspect ' + entity.name,
          selected: selectedEntityIds.includes(entity.id),
          ...(!atToday && !visibleEntityIds.has(entity.id)
            ? {
                style: { opacity: 0.15, pointerEvents: 'none' },
                focusable: false,
                selectable: false,
                draggable: false,
              }
            : ({} as Partial<EntityFlowNode>)),
        }));
      const hubNodes: HubFlowNode[] = groupHubs.map((hub) => ({
        id: hub.id,
        type: 'hub',
        position: { x: hub.position[0] - 72, y: hub.position[1] - 46 },
        data: {
          hub,
          dimension: columnLabel(hub.key),
          color: dimensionStyles.get(hub.key)?.color ?? 'var(--accent)',
          onInspect: (chosen: GroupHub) =>
            onGroup({
              label: chosen.label,
              dimension: columnLabel(chosen.key),
              count: chosen.count,
              members: chosen.members,
            }),
        },
        draggable: false,
        connectable: false,
      }));
      const rootNodes: RootFlowNode[] = groupRoots.map((root) => ({
        id: root.id,
        type: 'root',
        position: { x: root.position[0] - 90, y: root.position[1] - 46 },
        data: {
          root,
          color: dimensionStyles.get(root.key)?.color ?? 'var(--accent)',
        },
        draggable: false,
        connectable: false,
        selectable: false,
        focusable: false,
      }));
      return [...entityNodes, ...hubNodes, ...rootNodes];
    },
    [
      entities,
      degree,
      noteCounts,
      toggleFollow,
      atToday,
      visibleEntityIds,
      selectedEntityIds,
      onConnectFrom,
      onEntity,
      board?.nodeScale,
      groupBy,
      groupHubs,
      groupRoots,
      dimensionStyles,
      columnLabel,
      valueOf,
      onGroup,
    ],
  );
  const initialEdges = useMemo<ConnectionFlowEdge[]>(
    () =>
      connections
        .filter(
          (connection) =>
            entityMap.has(connection.from) &&
            entityMap.has(connection.to) &&
            positions[connection.from] !== undefined &&
            positions[connection.to] !== undefined,
        )
        .map((connection) => ({
          id: connection.id,
          source: connection.from,
          target: connection.to,
          type: 'connection',
          selected: selectedConnectionId === connection.id,
          data: { connection, onInspect: () => onConnection(connection) },
          ariaLabel:
            (entityMap.get(connection.from)?.name ?? connection.from) +
            ' ' +
            connection.label +
            ' ' +
            (entityMap.get(connection.to)?.name ?? connection.to),
          ...(!visibleConnectionIds.has(connection.id)
            ? {
                style: { opacity: 0.15, pointerEvents: 'none' },
                focusable: false,
                selectable: false,
              }
            : ({} as Partial<ConnectionFlowEdge>)),
        })),
    [
      connections,
      entityMap,
      positions,
      visibleConnectionIds,
      selectedConnectionId,
      onConnection,
    ],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ConnectionFlowEdge>(
    [],
  );
  useEffect(() => {
    let active = true;
    if (!boardId) return;
    void fetch('/api/workspace?layout=' + encodeURIComponent(boardId))
      .then(async (response) => {
        const data = (await response.json()) as {
          layout?: unknown;
          noteCounts?: Record<string, number>;
        };
        if (!response.ok) throw new Error();
        setNoteCounts(data.noteCounts ?? {});
        const layout = validLayout(data.layout);
        if (!active) return;
        const temporal = useGraphStore.temporal.getState();
        temporal.pause();
        replacePositions(layout);
        temporal.clear();
        temporal.resume();
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        replacePositions({});
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, [graphKey, boardId, replacePositions]);
  useEffect(() => {
    if (ready) setNodes(makeNodes(positions));
  }, [positions, makeNodes, ready, setNodes]);
  useEffect(() => {
    const drafts = draftEdges.filter(
      (draft) =>
        !connections.some(
          (connection) =>
            (connection.from === draft.source &&
              connection.to === draft.target) ||
            (connection.from === draft.target &&
              connection.to === draft.source),
        ),
    );
    if (drafts.length !== draftEdges.length) clearDraftEdges();
    // Only the dimension that placed the nodes draws a line to each of them. The
    // others would bury the map, so they show their overlap hub to hub instead.
    const hubEdges: ConnectionFlowEdge[] = groupHubs
      .filter((hub) => hub.primary)
      .flatMap((hub) =>
        hub.members
          .filter((id) => positions[id] !== undefined)
          .map((id) => ({
            id: `group-edge:${hub.id}:${id}`,
            source: hub.id,
            target: id,
            type: 'connection' as const,
            data: {
              group: 'member' as const,
              color: dimensionStyles.get(hub.key)?.color,
              dash: dimensionStyles.get(hub.key)?.dash,
            },
            selectable: false,
            focusable: false,
          })),
      );
    const rootEdges: ConnectionFlowEdge[] = groupRoots.flatMap((root) =>
      groupHubs
        .filter((hub) => hub.key === root.key)
        .map((hub) => ({
          id: `root-edge:${root.id}:${hub.id}`,
          source: root.id,
          target: hub.id,
          type: 'connection' as const,
          data: {
            group: 'root' as const,
            color: dimensionStyles.get(root.key)?.color,
          },
          selectable: false,
          focusable: false,
        })),
    );
    const bridgeEdges: ConnectionFlowEdge[] = groupBridges.map((bridge) => ({
      id: bridge.id,
      source: bridge.source,
      target: bridge.target,
      type: 'connection' as const,
      data: {
        group: 'bridge' as const,
        shared: bridge.shared,
        color: 'var(--graph-glow)',
        dash: '4 6',
      },
      selectable: false,
      focusable: false,
      ariaLabel: bridge.shared + ' shared entities',
    }));
    setEdges([
      ...initialEdges,
      ...hubEdges,
      ...rootEdges,
      ...bridgeEdges,
      ...drafts.map(
        (draft) =>
          ({
            id: draft.id,
            source: draft.source,
            target: draft.target,
            type: 'connection',
            data: { draft: true },
          }) as ConnectionFlowEdge,
      ),
    ]);
  }, [
    initialEdges,
    draftEdges,
    connections,
    clearDraftEdges,
    setEdges,
    groupHubs,
    groupRoots,
    groupBridges,
    dimensionStyles,
    positions,
  ]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,[contenteditable=true]'))
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) useGraphStore.temporal.getState().redo();
        else useGraphStore.temporal.getState().undo();
        return;
      }
      if (event.metaKey || event.ctrlKey) return;
      const next = ({ v: 'select', h: 'pan', c: 'connect', n: 'new' } as const)[
        event.key.toLowerCase() as 'v' | 'h' | 'c' | 'n'
      ];
      if (next) {
        event.preventDefault();
        setMode(next);
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [setMode]);
  const persist = useCallback(
    (layout: GraphLayout) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void fetch('/api/workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'layout',
            boardId,
            positions: layout,
          }),
        });
      }, 600);
    },
    [boardId],
  );
  const applyGroupedLayout = useCallback(() => {
    const boardEntityIds = new Set(
      Object.keys(useGraphStore.getState().positions),
    );
    const boardEntities = entities.filter((entity) =>
      boardEntityIds.has(entity.id),
    );
    if (!boardEntities.length) return;
    const next = groupedLayout(
      boardEntities,
      { key: groupBy, label: columnLabel(groupBy) },
      valueOf,
      extraKeys
        .filter((key) => key !== groupBy)
        .map((key) => ({ key, label: columnLabel(key) })),
    );
    setGroupHubs(next.hubs);
    setGroupRoots(next.roots);
    setGroupBridges(next.bridges);
    replacePositions(next.positions);
    persist(next.positions);
    setTimeout(() => void flow.fitView({ padding: 0.12, duration: 500 }), 30);
  }, [
    entities,
    groupBy,
    extraKeys,
    columnLabel,
    valueOf,
    replacePositions,
    persist,
    flow,
  ]);
  const groupCount = useMemo(
    () =>
      new Set(
        entities
          .filter((entity) => positions[entity.id] !== undefined)
          .map((entity) => valueOf(entity, groupBy)),
      ).size,
    [entities, positions, groupBy, valueOf],
  );
  // Grouping is a way of looking, not a saved property of the board: clearing it
  // takes the hubs and the dimension nodes away and leaves the entities where they
  // were dropped.
  const clearGrouping = useCallback(() => {
    setGroupHubs([]);
    setGroupRoots([]);
    setGroupBridges([]);
    onGroup(null);
  }, [onGroup]);
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );
  const isValidConnection = useCallback(
    (candidate: FlowConnection | ConnectionFlowEdge) => {
      const source = candidate.source,
        target = candidate.target;
      if (!source || !target || source === target) return false;
      return ![
        ...connections,
        ...draftEdges.map((edge) => ({ from: edge.source, to: edge.target })),
      ].some(
        (connection) =>
          (connection.from === source && connection.to === target) ||
          (connection.from === target && connection.to === source),
      );
    },
    [connections, draftEdges],
  );
  const connect = useCallback(
    (candidate: FlowConnection) => {
      if (
        !candidate.source ||
        !candidate.target ||
        !isValidConnection(candidate)
      )
        return;
      const id = 'draft:' + candidate.source + ':' + candidate.target;
      addDraftEdge({ id, source: candidate.source, target: candidate.target });
      onConnectPair(candidate.source, candidate.target);
    },
    [addDraftEdge, isValidConnection, onConnectPair],
  );
  // Hover cards follow the cursor inside the canvas, so every position is measured
  // against the canvas box rather than the page.
  const pointAt = useCallback((event: { clientX: number; clientY: number }) => {
    const box = canvas.current?.getBoundingClientRect();
    return {
      x: event.clientX - (box?.left ?? 0),
      y: event.clientY - (box?.top ?? 0),
    };
  }, []);
  const hoverNode = useCallback(
    (event: { clientX: number; clientY: number }, node: GraphFlowNode) => {
      if (node.type === 'hub') {
        const { hub, dimension } = node.data as HubFlowNode['data'];
        return setHover({
          kind: 'group',
          ...pointAt(event),
          label: hub.label,
          dimension,
          count: hub.count,
          members: hub.members.map(
            (id) => entityMap.get(id)?.name ?? id,
          ),
          primary: hub.primary,
        });
      }
      if (node.type !== 'entity') return setHover(null);
      const entity = (node.data as EntityFlowNode['data']).entity;
      setHover({
        kind: 'entity',
        ...pointAt(event),
        entity,
        degree: degree[entity.id] ?? 0,
        notes: noteCounts[entity.id] ?? 0,
      });
    },
    [degree, noteCounts, pointAt, entityMap],
  );
  const hoverEdge = useCallback(
    (event: { clientX: number; clientY: number }, edge: ConnectionFlowEdge) => {
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
  const clearHover = useCallback(() => setHover(null), []);
  return (
    <div
      className={
        'graph flow-graph ' + (full ? 'full-graph ' : '') + 'mode-' + mode
      }
      onDoubleClick={(event) => {
        if (mode !== 'auto') return;
        if (
          !(event.target as HTMLElement).classList.contains('react-flow__pane')
        )
          return;
        const position = flow.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        onNewEntity([Math.round(position.x), Math.round(position.y)]);
      }}
      style={
        {
          '--board-surface': board?.surface ?? '#131d26',
          '--board-image': board?.image ? 'url("' + board.image + '")' : 'none',
          '--board-image-size':
            board?.imageFit === 'contain'
              ? 'contain'
              : board?.imageFit === 'tile'
                ? 'auto'
                : 'cover',
          '--board-image-repeat':
            board?.imageFit === 'tile' ? 'repeat' : 'no-repeat',
          '--board-scrim': board?.image ? 'rgba(19,29,38,.62)' : 'transparent',
        } as CSSProperties
      }
    >
      <div className="graph-top">
        <span>
          <span className="live-dot" /> YOUR KNOWLEDGE NETWORK
        </span>
        <div className="graph-auto-layout">
          <label>
            Group by
            <select
              value={groupBy}
              onChange={(event) => {
                setGroupBy(event.target.value);
                clearGrouping();
              }}
            >
              {groupColumns.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label} · {column.distinct} groups
                </option>
              ))}
            </select>
          </label>
          <Popover>
            <PopoverTrigger className="graph-compare">
              <Layers size={13} /> Compare
              {extraKeys.length > 0 && <b>{extraKeys.length}</b>}
            </PopoverTrigger>
            <PopoverContent
              className="data-popover"
              align="end"
              sideOffset={8}
            >
              <span className="data-popover-title">
                Show these groupings too
              </span>
              <div className="data-column-list">
                {groupColumns
                  .filter((column) => column.key !== groupBy)
                  .map((column) => (
                    <label key={column.key}>
                      <input
                        type="checkbox"
                        checked={extraKeys.includes(column.key)}
                        onChange={() =>
                          setExtraKeys((current) =>
                            current.includes(column.key)
                              ? current.filter((key) => key !== column.key)
                              : [...current, column.key].slice(-3),
                          )
                        }
                      />
                      <span>{column.label}</span>
                      <small>{column.distinct} groups</small>
                    </label>
                  ))}
              </div>
              <p className="data-popover-note">
                Their piles sit under the map and join the ones they share
                entities with. Only the group-by dimension moves nodes.
              </p>
            </PopoverContent>
          </Popover>
          <button type="button" onClick={applyGroupedLayout} disabled={!ready}>
            Auto-arrange
          </button>
          {groupHubs.length > 0 && (
            <button
              type="button"
              className="graph-clear-groups"
              onClick={clearGrouping}
            >
              Clear grouping
            </button>
          )}
          <span>
            {groupCount} groups ·{' '}
            {nodes.filter((node) => node.type === 'entity').length} companies
          </span>
        </div>
      </div>
      <div className="flow-canvas" data-ready={ready} ref={canvas}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => {
            if (node.type !== 'entity') return;
            useWorkspaceStore.getState().selectEntity(node.id);
            onEntity(node.data.entity);
          }}
          onEdgeClick={(_, edge) => {
            if (edge.data?.connection) {
              useWorkspaceStore.getState().selectConnection(edge.id);
              onConnection(edge.data.connection);
            }
          }}
          onNodeMouseEnter={hoverNode}
          onNodeMouseMove={hoverNode}
          onNodeMouseLeave={clearHover}
          onEdgeMouseEnter={hoverEdge}
          onEdgeMouseMove={hoverEdge}
          onEdgeMouseLeave={clearHover}
          onNodeDragStart={clearHover}
          onMoveStart={clearHover}
          onNodeDragStop={(_, node) => {
            if (node.type !== 'entity') return;
            const position: [number, number] = [
              Math.round(node.position.x),
              Math.round(node.position.y),
            ];
            moveNode(node.id, position);
            persist({
              ...useGraphStore.getState().positions,
              [node.id]: position,
            });
          }}
          onConnect={connect}
          isValidConnection={isValidConnection}
          connectionMode={ConnectionMode.Loose}
          nodesDraggable={mode === 'auto' || mode === 'select'}
          panOnDrag={mode === 'auto' || mode === 'pan'}
          selectionKeyCode={mode === 'auto' ? 'Shift' : null}
          zoomOnDoubleClick={false}
          selectionOnDrag={mode === 'select'}
          nodesConnectable={mode !== 'pan'}
          elementsSelectable={mode !== 'pan'}
          onPaneClick={(event) => {
            if (mode === 'new') {
              const position = flow.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
              });
              onNewEntity([Math.round(position.x), Math.round(position.y)]);
            }
          }}
          defaultViewport={viewport}
          onMoveEnd={(_, next) => {
            try {
              localStorage.setItem('graph-viewport', JSON.stringify(next));
            } catch {}
          }}
          fitView={viewport.x === 0 && viewport.y === 0 && viewport.zoom === 1}
          minZoom={0.35}
          maxZoom={2}
          nodesFocusable
          edgesFocusable
        >
          {board?.pattern !== 'none' && (
            <Background
              variant={
                board?.pattern === 'lines'
                  ? BackgroundVariant.Lines
                  : board?.pattern === 'cross'
                    ? BackgroundVariant.Cross
                    : BackgroundVariant.Dots
              }
              gap={board?.gap ?? 22}
              size={1}
              color={board?.patternColor ?? '#2e3c48'}
            />
          )}
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => {
              if (node.type === 'hub' || node.type === 'root')
                return (
                  (node.data as { color?: string }).color ?? 'var(--accent)'
                );
              return (node.data as EntityFlowNode['data']).entity.color;
            }}
          />
        </ReactFlow>
        <GraphHoverCard target={hover} />
      </div>
      {showTimeline && (
        <TimelineScrubber
          from={timelineFrom}
          to={TODAY}
          value={asOf}
          hiddenConnections={
            connections.filter((connection) => connection.date > asOf).length
          }
          onChange={setAsOf}
        />
      )}
    </div>
  );
}
export function GraphEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
