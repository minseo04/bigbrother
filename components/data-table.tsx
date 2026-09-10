'use client';
// One table serves the workspace and the shared view. Columns come from the data
// rather than a fixed list, so an attribute someone adds today is a column, a sort
// key and a downloadable field without any code changing.
import { useMemo, useState } from 'react';
import { Columns3, Download, Table2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  cellText,
  compareCells,
  edgeColumns,
  edgeRecords,
  recordsToCsv,
  toCsv,
  toGraph,
  toRecords,
  type Column,
  type Table,
} from '@/lib/dataframe';
import type { Connection, Entity } from '@/lib/intelligence';
type Props = {
  table: Table;
  connections: Connection[];
  positions?: Record<string, [number, number]>;
  board: { id: string; name: string };
  selectedId?: string;
  onSelect?: (entity: Entity) => void;
  density?: 'cosy' | 'compact';
  storageKey?: string;
};
const alwaysOn = ['name', 'kind', 'links'];
// Attributes someone took the trouble to record are always shown; the seeded profile
// columns are offered by how much of the board actually fills them.
function defaultVisible(columns: Column[]) {
  const custom = columns
    .filter((column) => column.source === 'custom')
    .map((column) => column.key);
  const profile = columns
    .filter(
      (column) =>
        column.source === 'profile' && !alwaysOn.includes(column.key),
    )
    .sort((a, b) => b.filled - a.filled)
    .slice(0, 5)
    .map((column) => column.key);
  return [...alwaysOn, 'notes', ...custom, ...profile];
}
function readVisible(storageKey: string, columns: Column[]) {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const value = JSON.parse(saved) as unknown;
      if (Array.isArray(value) && value.every((key) => typeof key === 'string'))
        return value.filter((key) =>
          columns.some((column) => column.key === key),
        );
    }
  } catch {}
  return defaultVisible(columns);
}
function saveFile(name: string, mime: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function fileStem(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'board'
  );
}
export function DataTable({
  table,
  connections,
  positions,
  board,
  selectedId,
  onSelect,
  density = 'cosy',
  storageKey = 'table-columns',
}: Props) {
  const [stored, setStored] = useState<string[]>(() =>
    readVisible(storageKey, table.columns),
  );
  // Columns that appear after this table mounted — an attribute someone just added —
  // show themselves rather than hiding until the next reload.
  const [known, setKnown] = useState<string[]>(() =>
    table.columns.map((column) => column.key),
  );
  const visible = useMemo(
    () => [
      ...new Set([
        ...stored,
        ...table.columns
          .filter((column) => !known.includes(column.key))
          .map((column) => column.key),
      ]),
    ],
    [stored, table.columns, known],
  );
  const [sort, setSort] = useState<{ key: string; ascending: boolean }>({
    key: 'links',
    ascending: false,
  });
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [withGraph, setWithGraph] = useState(false);
  const columns = useMemo(
    () =>
      table.columns.filter((column) =>
        visible.includes(column.key),
      ),
    [table.columns, visible],
  );
  const sorted = useMemo(() => {
    const column = table.columns.find((item) => item.key === sort.key);
    if (!column) return table.rows;
    return [...table.rows].sort((a, b) => {
      const order = compareCells(
        a.cells[column.key],
        b.cells[column.key],
        column.type,
      );
      return sort.ascending ? -order : order;
    });
  }, [table.rows, table.columns, sort]);
  function toggle(key: string) {
    const next = visible.includes(key)
      ? visible.filter((item) => item !== key)
      : [...visible, key];
    setStored(next);
    setKnown(table.columns.map((column) => column.key));
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }
  // Two tables and, if asked for, the shape. Nodes carry their attributes, edges
  // carry their evidence, and the layout file repeats neither.
  function download() {
    const stem = fileStem(board.name);
    const edges = edgeRecords(
      connections,
      sorted.map((row) => row.entity),
    );
    if (format === 'csv') {
      saveFile(
        stem + '-nodes.csv',
        'text/csv;charset=utf-8',
        toCsv(sorted, columns),
      );
      saveFile(
        stem + '-edges.csv',
        'text/csv;charset=utf-8',
        recordsToCsv(edges, edgeColumns),
      );
    } else {
      saveFile(
        stem + '-nodes.json',
        'application/json',
        JSON.stringify(toRecords(sorted, columns), null, 2),
      );
      saveFile(
        stem + '-edges.json',
        'application/json',
        JSON.stringify(edges, null, 2),
      );
    }
    if (withGraph)
      saveFile(
        stem + '-graph.json',
        'application/json',
        JSON.stringify(
          toGraph({ rows: sorted, columns }, connections, positions ?? {}, board),
        ),
      );
  }
  return (
    <div className={'data-view density-' + density}>
      <div className="data-toolbar">
        <span className="data-count">
          <Table2 size={14} /> {sorted.length} rows · {table.columns.length}{' '}
          columns
        </span>
        <Popover>
          <PopoverTrigger className="data-button">
            <Columns3 size={14} /> Columns ({columns.length})
          </PopoverTrigger>
          <PopoverContent className="data-popover" align="end" sideOffset={8}>
            <span className="data-popover-title">Columns</span>
            <div className="data-column-list">
              {table.columns.map((column) => (
                <label key={column.key}>
                  <input
                    type="checkbox"
                    checked={visible.includes(column.key)}
                    onChange={() => toggle(column.key)}
                  />
                  <span>{column.label}</span>
                  <small>
                    {column.source === 'custom' ? 'added · ' : ''}
                    {column.filled}/{table.rows.length}
                  </small>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="data-download">
          <select
            value={format}
            onChange={(event) =>
              setFormat(event.target.value === 'json' ? 'json' : 'csv')
            }
            aria-label="Download format"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
          <label className="data-graph-toggle">
            <input
              type="checkbox"
              checked={withGraph}
              onChange={(event) => setWithGraph(event.target.checked)}
            />
            Layout too
          </label>
          <button
            type="button"
            className="data-primary"
            onClick={download}
            title={
              'Downloads ' +
              (withGraph ? 'three files' : 'two files') +
              ': nodes, edges' +
              (withGraph ? ', and the layout' : '')
            }
          >
            <Download size={14} /> Download
          </button>
        </div>
      </div>
      <div className="data-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} aria-sort={sort.key === column.key ? (sort.ascending ? 'ascending' : 'descending') : 'none'}>
                  <button
                    type="button"
                    onClick={() =>
                      setSort((current) =>
                        current.key === column.key
                          ? { key: column.key, ascending: !current.ascending }
                          : { key: column.key, ascending: false },
                      )
                    }
                  >
                    {column.label}
                    {sort.key === column.key && (
                      <i>{sort.ascending ? '▲' : '▼'}</i>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.id}
                className={row.id === selectedId ? 'is-active' : ''}
                tabIndex={onSelect ? 0 : -1}
                onClick={() => onSelect?.(row.entity)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSelect?.(row.entity);
                }}
              >
                {columns.map((column) => (
                  <td key={column.key} data-type={column.type}>
                    {column.key === 'name' ? (
                      <>
                        <i style={{ background: row.entity.color }} />
                        {row.entity.name}
                      </>
                    ) : (
                      cellText(row.cells[column.key]) || '—'
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!sorted.length && (
          <p className="data-empty">Nothing matches the current filters.</p>
        )}
      </div>
    </div>
  );
}
