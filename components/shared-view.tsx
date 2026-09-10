'use client';
/* eslint-disable next/no-img-element -- entity images are arbitrary URLs from the shared workspace. */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Eye,
  LayoutGrid,
  Moon,
  Network,
  Rows3,
  Search,
  Share2,
  Sun,
  Table2,
  X,
} from 'lucide-react';
import { SharedMap } from '@/components/shared-map';
import { DataTable } from '@/components/data-table';
import { buildTable, type Attribute } from '@/lib/dataframe';
import { hostOf } from '@/components/graph-hovercard';
import type { Connection, Entity } from '@/lib/intelligence';
type Board = {
  id: string;
  name: string;
  pattern: string;
  patternColor: string;
  surface: string;
  gap: number;
  nodeScale: number;
};
type Project = {
  title: string;
  created: string;
  board: Board;
  layout: Record<string, [number, number]>;
  entities: Entity[];
  connections: Connection[];
  noteCounts: Record<string, number>;
  attributes: Attribute[];
};
type View = 'map' | 'table' | 'cards' | 'timeline';
type Sort = 'name' | 'links' | 'kind' | 'notes';
type Prefs = {
  view: View;
  theme: 'dark' | 'light';
  density: 'cosy' | 'compact';
  sort: Sort;
};
// The viewer's reading preferences, not the author's. They live on this device and
// apply to every shared board this person opens.
const defaults: Prefs = {
  view: 'map',
  theme: 'dark',
  density: 'cosy',
  sort: 'links',
};
function readPrefs(): Prefs {
  try {
    const saved = localStorage.getItem('shared-prefs');
    if (!saved) return defaults;
    const value = JSON.parse(saved) as Partial<Prefs>;
    return {
      view: (['map', 'table', 'cards', 'timeline'] as View[]).includes(
        value.view as View,
      )
        ? (value.view as View)
        : defaults.view,
      theme: value.theme === 'light' ? 'light' : 'dark',
      density: value.density === 'compact' ? 'compact' : 'cosy',
      sort: (['name', 'links', 'kind', 'notes'] as Sort[]).includes(
        value.sort as Sort,
      )
        ? (value.sort as Sort)
        : defaults.sort,
    };
  } catch {
    return defaults;
  }
}
// Preferences live outside React so the server renders the neutral defaults and the
// browser swaps in this device's saved choices on hydration.
let cached: Prefs | null = null;
const listeners = new Set<() => void>();
function currentPrefs() {
  if (!cached) cached = readPrefs();
  return cached;
}
function serverPrefs() {
  return defaults;
}
function subscribePrefs(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function writePrefs(change: Partial<Prefs>) {
  cached = { ...currentPrefs(), ...change };
  try {
    localStorage.setItem('shared-prefs', JSON.stringify(cached));
  } catch {}
  for (const listener of listeners) listener();
}
const views: [View, string, typeof Network][] = [
  ['map', 'Map', Network],
  ['table', 'Table', Table2],
  ['cards', 'Cards', LayoutGrid],
  ['timeline', 'Timeline', CalendarDays],
];
const ALL = 'All';
export function SharedView({ token }: { token: string }) {
  const prefs = useSyncExternalStore(subscribePrefs, currentPrefs, serverPrefs);
  const [project, setProject] = useState<Project | null>(null),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [kind, setKind] = useState(ALL),
    [selectedEntity, setSelectedEntity] = useState<Entity | null>(null),
    [selectedConnection, setSelectedConnection] = useState<Connection | null>(
      null,
    );
  useEffect(() => {
    let active = true;
    void fetch('/api/shared?token=' + encodeURIComponent(token))
      .then(async (response) => {
        const data = (await response.json()) as Project & { error?: string };
        if (!active) return;
        if (!response.ok)
          throw new Error(data.error ?? 'This board could not be opened.');
        setProject(data);
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [token]);
  const update = writePrefs;
  const entities = useMemo(() => project?.entities ?? [], [project]),
    connections = useMemo(() => project?.connections ?? [], [project]),
    noteCounts = useMemo(() => project?.noteCounts ?? {}, [project]),
    attributes = useMemo(() => project?.attributes ?? [], [project]);
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
      ) as Record<string, number>,
    [entities, connections],
  );
  const kinds = useMemo(
    () => [...new Set(entities.map((entity) => entity.kind))].sort(),
    [entities],
  );
  const needle = query.trim().toLowerCase();
  const shownEntities = useMemo(
    () =>
      entities
        .filter((entity) => {
          if (kind !== ALL && entity.kind !== kind) return false;
          if (!needle) return true;
          const profile = entity.profile;
          return [
            entity.name,
            entity.kind,
            entity.description,
            entity.aliases.join(' '),
            profile?.vertical ?? '',
            profile?.hq ?? '',
            profile?.stage ?? '',
            profile?.targetCustomer ?? '',
            profile?.tags.join(' ') ?? '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(needle);
        })
        .sort((a, b) =>
          prefs.sort === 'name'
            ? a.name.localeCompare(b.name)
            : prefs.sort === 'kind'
              ? a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
              : prefs.sort === 'notes'
                ? (noteCounts[b.id] ?? 0) - (noteCounts[a.id] ?? 0) ||
                  a.name.localeCompare(b.name)
                : (degree[b.id] ?? 0) - (degree[a.id] ?? 0) ||
                  a.name.localeCompare(b.name),
        ),
    [entities, kind, needle, prefs.sort, degree, noteCounts],
  );
  const shownIds = useMemo(
    () => new Set(shownEntities.map((entity) => entity.id)),
    [shownEntities],
  );
  const shownConnections = useMemo(
    () =>
      connections.filter(
        (connection) =>
          shownIds.has(connection.from) && shownIds.has(connection.to),
      ),
    [connections, shownIds],
  );
  const filtered = shownEntities.length !== entities.length;
  const shownLayout = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(project?.layout ?? {}).filter(([id]) =>
          shownIds.has(id),
        ),
      ) as Record<string, [number, number]>,
    [project?.layout, shownIds],
  );
  const table = useMemo(
    () => buildTable(shownEntities, shownConnections, noteCounts, attributes),
    [shownEntities, shownConnections, noteCounts, attributes],
  );
  function openEntity(entity: Entity) {
    setSelectedEntity(entity);
    setSelectedConnection(null);
  }
  function openConnection(connection: Connection) {
    setSelectedConnection(connection);
    setSelectedEntity(null);
  }
  if (error)
    return (
      <div className="shared-empty">
        <div className="shared-empty-card">
          <Share2 size={20} />
          <h1>This board is not available</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  if (!project)
    return (
      <div className="shared-empty">
        <div className="shared-empty-card">
          <Share2 size={20} />
          <h1>Opening the shared board…</h1>
          <p>Reading the entities, connections and the sources behind them.</p>
        </div>
      </div>
    );
  const selectedId = selectedEntity?.id ?? selectedConnection?.id ?? '';
  return (
    <div
      className={'shared-view density-' + prefs.density}
      data-theme={prefs.theme}
    >
      <header className="shared-topbar">
        <div className="shared-identity">
          <Share2 size={16} />
          <div>
            <strong>{project.title}</strong>
            <small>
              Read-only share · {entities.length} entities ·{' '}
              {connections.length} connections
            </small>
          </div>
        </div>
        <label className="shared-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search this board"
            aria-label="Search this board"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </label>
        <div className="shared-switch" role="tablist" aria-label="View">
          {views.map(([value, label, Icon]) => (
            <button
              key={value}
              role="tab"
              aria-selected={prefs.view === value}
              className={prefs.view === value ? 'is-active' : ''}
              onClick={() => update({ view: value })}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <div className="shared-prefs">
          <button
            type="button"
            onClick={() =>
              update({ theme: prefs.theme === 'dark' ? 'light' : 'dark' })
            }
            aria-label={
              prefs.theme === 'dark'
                ? 'Switch to a light background'
                : 'Switch to a dark background'
            }
          >
            {prefs.theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            type="button"
            className={prefs.density === 'compact' ? 'is-active' : ''}
            onClick={() =>
              update({
                density: prefs.density === 'compact' ? 'cosy' : 'compact',
              })
            }
            aria-label="Toggle compact spacing"
          >
            <Rows3 size={14} />
          </button>
        </div>
      </header>
      <div className="shared-filters">
        <div className="shared-chips">
          {[ALL, ...kinds].map((value) => (
            <button
              key={value}
              className={value === kind ? 'is-active' : ''}
              onClick={() => setKind(value)}
            >
              {value}
              <b>
                {value === ALL
                  ? entities.length
                  : entities.filter((entity) => entity.kind === value).length}
              </b>
            </button>
          ))}
        </div>
        {prefs.view === 'cards' && (
          <label className="shared-sort">
            Sort
            <select
              value={prefs.sort}
              onChange={(event) => update({ sort: event.target.value as Sort })}
            >
              <option value="links">Most connected</option>
              <option value="name">Name</option>
              <option value="kind">Category</option>
              <option value="notes">Notes</option>
            </select>
          </label>
        )}
        <span className="shared-count">
          {shownEntities.length} of {entities.length} shown
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setKind(ALL);
              }}
            >
              Reset
            </button>
          )}
        </span>
      </div>
      <div className="shared-body">
        <section className="shared-stage">
          {prefs.view === 'map' && (
            <SharedMap
              entities={shownEntities}
              connections={shownConnections}
              layout={shownLayout}
              noteCounts={noteCounts}
              board={
                prefs.theme === 'light'
                  ? {
                      ...project.board,
                      surface: '#eef2f7',
                      patternColor: '#d5dee6',
                    }
                  : project.board
              }
              selectedId={selectedId}
              onEntity={openEntity}
              onConnection={openConnection}
            />
          )}
          {prefs.view === 'table' && (
            <DataTable
              table={table}
              connections={shownConnections}
              positions={project.layout}
              board={{ id: project.board.id, name: project.title }}
              selectedId={selectedId}
              onSelect={openEntity}
              density={prefs.density}
              storageKey="shared-table-columns"
            />
          )}
          {prefs.view === 'cards' && (
            <div className="shared-scroll">
              <div className="shared-cards">
                {shownEntities.map((entity) => (
                  <button
                    key={entity.id}
                    className={
                      'shared-card' +
                      (entity.id === selectedId ? ' is-active' : '')
                    }
                    style={{ '--entity-color': entity.color } as CSSProperties}
                    onClick={() => openEntity(entity)}
                  >
                    <span className="shared-card-top">
                      <i>
                        {entity.image ? (
                          <img src={entity.image} alt="" />
                        ) : (
                          entity.initials
                        )}
                      </i>
                      <span>
                        <strong>{entity.name}</strong>
                        <small>{entity.kind}</small>
                      </span>
                    </span>
                    <p>{entity.description}</p>
                    <span className="shared-card-meta">
                      <span>{degree[entity.id] ?? 0} links</span>
                      <span>{noteCounts[entity.id] ?? 0} notes</span>
                      {entity.profile?.hq && <span>{entity.profile.hq}</span>}
                    </span>
                  </button>
                ))}
              </div>
              {!shownEntities.length && (
                <p className="shared-none">Nothing matches that search.</p>
              )}
            </div>
          )}
          {prefs.view === 'timeline' && (
            <div className="shared-scroll">
              <ol className="shared-timeline">
                {[...shownConnections]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((connection) => (
                    <li key={connection.id}>
                      <button
                        className={
                          connection.id === selectedId ? 'is-active' : ''
                        }
                        onClick={() => openConnection(connection)}
                      >
                        <span className="shared-timeline-date">
                          {connection.date}
                        </span>
                        <span className="shared-timeline-body">
                          <strong>
                            {entityMap.get(connection.from)?.name ??
                              connection.from}
                          </strong>
                          <em>{connection.label}</em>
                          <strong>
                            {entityMap.get(connection.to)?.name ??
                              connection.to}
                          </strong>
                        </span>
                        <span
                          className={
                            'shared-status' +
                            (connection.status === 'Hypothesis'
                              ? ' is-hypothesis'
                              : '')
                          }
                        >
                          {connection.status}
                        </span>
                      </button>
                    </li>
                  ))}
              </ol>
              {!shownConnections.length && (
                <p className="shared-none">
                  No connections between the entities currently shown.
                </p>
              )}
            </div>
          )}
        </section>
        {(selectedEntity || selectedConnection) && (
          <aside className="shared-detail">
            <button
              className="shared-detail-close"
              onClick={() => {
                setSelectedEntity(null);
                setSelectedConnection(null);
              }}
              aria-label="Close details"
            >
              <X size={15} />
            </button>
            {selectedEntity && (
              <>
                <header>
                  <i style={{ background: selectedEntity.color }} />
                  <div>
                    <strong>{selectedEntity.name}</strong>
                    <small>{selectedEntity.kind}</small>
                  </div>
                </header>
                <p>{selectedEntity.description}</p>
                {selectedEntity.profile && (
                  <dl className="shared-detail-facts">
                    {(
                      [
                        ['Business area', selectedEntity.profile.vertical],
                        ['Technology layer', selectedEntity.profile.layer],
                        ['Headquarters', selectedEntity.profile.hq],
                        ['Stage', selectedEntity.profile.stage],
                        ['Customer', selectedEntity.profile.targetCustomer],
                        ['Revenue model', selectedEntity.profile.revenueModel],
                      ] as [string, string][]
                    )
                      .filter(([, value]) => Boolean(value))
                      .map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                  </dl>
                )}
                {selectedEntity.source && (
                  <a
                    className="shared-source"
                    href={selectedEntity.source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ArrowUpRight size={13} /> {hostOf(selectedEntity.source)}
                  </a>
                )}
                <h2>Connections ({degree[selectedEntity.id] ?? 0})</h2>
                <ul className="shared-detail-links">
                  {connections
                    .filter(
                      (connection) =>
                        connection.from === selectedEntity.id ||
                        connection.to === selectedEntity.id,
                    )
                    .map((connection) => {
                      const other = entityMap.get(
                        connection.from === selectedEntity.id
                          ? connection.to
                          : connection.from,
                      );
                      return (
                        <li key={connection.id}>
                          <button onClick={() => openConnection(connection)}>
                            <em>{connection.label}</em>
                            <strong>{other?.name ?? '—'}</strong>
                            <small>{connection.date}</small>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </>
            )}
            {selectedConnection && (
              <>
                <header>
                  <div>
                    <strong>{selectedConnection.label}</strong>
                    <small>{selectedConnection.date}</small>
                  </div>
                </header>
                <p className="shared-detail-pair">
                  <button
                    onClick={() => {
                      const entity = entityMap.get(selectedConnection.from);
                      if (entity) openEntity(entity);
                    }}
                  >
                    {entityMap.get(selectedConnection.from)?.name ??
                      selectedConnection.from}
                  </button>
                  <span>→</span>
                  <button
                    onClick={() => {
                      const entity = entityMap.get(selectedConnection.to);
                      if (entity) openEntity(entity);
                    }}
                  >
                    {entityMap.get(selectedConnection.to)?.name ??
                      selectedConnection.to}
                  </button>
                </p>
                <span
                  className={
                    'shared-status' +
                    (selectedConnection.status === 'Hypothesis'
                      ? ' is-hypothesis'
                      : '')
                  }
                >
                  {selectedConnection.status}
                </span>
                <h2>Evidence</h2>
                <p>{selectedConnection.evidence}</p>
                <a
                  className="shared-source"
                  href={selectedConnection.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ArrowUpRight size={13} /> {hostOf(selectedConnection.url)}
                </a>
              </>
            )}
          </aside>
        )}
      </div>
      <footer className="shared-footer">
        <Eye size={13} /> You are reading a shared copy. Nothing here changes
        the original, and the notes behind it stay private.
      </footer>
    </div>
  );
}
