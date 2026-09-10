// The workspace as a table: one row per entity, one column per attribute. Everything
// here is a pure function of data already loaded in the browser, so the table view,
// the group-by picker and the CSV/JSON downloads all read from one source and no
// export needs a round trip to the server.
import type { Connection, Entity, MarketProfile } from './intelligence';

export type CellValue = string | number | boolean | string[];
export type ColumnSource = 'core' | 'profile' | 'custom';
export type ColumnType = 'text' | 'number' | 'boolean' | 'list';
export type Column = {
  key: string;
  label: string;
  source: ColumnSource;
  type: ColumnType;
  filled: number;
  distinct: number;
  groupable: boolean;
};
export type Row = { id: string; entity: Entity; cells: Record<string, CellValue> };
export type Attribute = {
  entityId: string;
  key: string;
  value: string;
  sourceUrl?: string;
  origin?: string;
  contributor?: string;
};
export type Table = { rows: Row[]; columns: Column[] };

type Definition = { key: string; label: string; type: ColumnType };
const coreDefinitions: Definition[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'kind', label: 'Category', type: 'text' },
  { key: 'links', label: 'Links', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'number' },
  { key: 'followed', label: 'Following', type: 'boolean' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'aliases', label: 'Aliases', type: 'list' },
  { key: 'source', label: 'Source', type: 'text' },
  { key: 'id', label: 'ID', type: 'text' },
];
const profileDefinitions: (Definition & {
  read: (profile: MarketProfile) => CellValue;
})[] = [
  {
    key: 'vertical',
    label: 'Business area',
    type: 'text',
    read: (p) => p.vertical,
  },
  {
    key: 'layer',
    label: 'Technology layer',
    type: 'text',
    read: (p) => p.layer,
  },
  { key: 'hq', label: 'Headquarters', type: 'text', read: (p) => p.hq },
  { key: 'stage', label: 'Stage', type: 'text', read: (p) => p.stage },
  {
    key: 'targetCustomer',
    label: 'Customer',
    type: 'text',
    read: (p) => p.targetCustomer,
  },
  {
    key: 'revenueModel',
    label: 'Revenue model',
    type: 'text',
    read: (p) => p.revenueModel,
  },
  { key: 'products', label: 'Products', type: 'list', read: (p) => p.products },
  { key: 'tags', label: 'Tags', type: 'list', read: (p) => p.tags },
  { key: 'founded', label: 'Founded', type: 'number', read: (p) => p.founded },
  {
    key: 'opportunityScore',
    label: 'Opportunity',
    type: 'number',
    read: (p) => p.opportunityScore,
  },
  { key: 'startup', label: 'Startup', type: 'boolean', read: (p) => p.startup },
  { key: 'website', label: 'Website', type: 'text', read: (p) => p.website },
];
export function normalizeKey(key: string) {
  return key.trim().toLowerCase();
}
function isEmpty(value: CellValue | undefined) {
  if (value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
// Attributes arrive as text because that is all the column can hold. A column reads
// as a number or a flag only when every value in it does.
function inferType(values: string[]): ColumnType {
  const filled = values.filter((value) => value !== '');
  if (!filled.length) return 'text';
  if (filled.every((value) => Number.isFinite(Number(value)) && value.trim() !== ''))
    return 'number';
  const flags = ['true', 'false', 'yes', 'no'];
  if (filled.every((value) => flags.includes(value.toLowerCase())))
    return 'boolean';
  return 'text';
}
function castValue(value: string, type: ColumnType): CellValue {
  if (type === 'number') return Number(value);
  if (type === 'boolean') return ['true', 'yes'].includes(value.toLowerCase());
  return value;
}
export function buildTable(
  entities: Entity[],
  connections: Connection[],
  noteCounts: Record<string, number>,
  attributes: Attribute[],
): Table {
  const degree: Record<string, number> = {};
  for (const entity of entities) degree[entity.id] = 0;
  for (const connection of connections) {
    if (degree[connection.from] !== undefined) degree[connection.from] += 1;
    if (degree[connection.to] !== undefined) degree[connection.to] += 1;
  }
  const byEntity = new Map<string, Attribute[]>();
  for (const attribute of attributes) {
    byEntity.set(attribute.entityId, [
      ...(byEntity.get(attribute.entityId) ?? []),
      attribute,
    ]);
  }
  // Custom columns are discovered from the data, keyed without case so one column
  // never splits in two. The first spelling seen becomes the label.
  const customLabels = new Map<string, string>();
  const customValues = new Map<string, string[]>();
  for (const attribute of attributes) {
    const key = normalizeKey(attribute.key);
    if (!key) continue;
    if (!customLabels.has(key)) customLabels.set(key, attribute.key.trim());
    customValues.set(key, [...(customValues.get(key) ?? []), attribute.value]);
  }
  const customDefinitions: Definition[] = [...customLabels.entries()]
    .map(([key, label]) => ({
      key,
      label,
      type: inferType(customValues.get(key) ?? []),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const rows: Row[] = entities.map((entity) => {
    const cells: Record<string, CellValue> = {
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      links: degree[entity.id] ?? 0,
      notes: noteCounts[entity.id] ?? 0,
      followed: entity.followed,
      description: entity.description,
      aliases: entity.aliases,
      source: entity.source,
    };
    if (entity.profile) {
      for (const definition of profileDefinitions)
        cells[definition.key] = definition.read(entity.profile);
    }
    // A workspace attribute overrides the seeded profile value of the same name.
    for (const attribute of byEntity.get(entity.id) ?? []) {
      const key = normalizeKey(attribute.key);
      const definition = customDefinitions.find((item) => item.key === key);
      cells[key] = castValue(attribute.value, definition?.type ?? 'text');
    }
    return { id: entity.id, entity, cells };
  });
  const definitions: (Definition & { source: ColumnSource })[] = [
    ...coreDefinitions.map((item) => ({ ...item, source: 'core' as const })),
    ...profileDefinitions
      .filter(
        (item) => !customDefinitions.some((custom) => custom.key === item.key),
      )
      .map((item) => ({
        key: item.key,
        label: item.label,
        type: item.type,
        source: 'profile' as const,
      })),
    ...customDefinitions.map((item) => ({ ...item, source: 'custom' as const })),
  ];
  const columns: Column[] = definitions.map((definition) => {
    const values = rows.map((row) => row.cells[definition.key]);
    const present = values.filter((value) => !isEmpty(value));
    const distinct = new Set(
      present.flatMap((value) =>
        Array.isArray(value) ? value : [String(value)],
      ),
    ).size;
    return {
      key: definition.key,
      label: definition.label,
      source: definition.source,
      type: definition.type,
      filled: present.length,
      distinct,
      groupable: groupable(definition, present.length, distinct, rows.length),
    };
  });
  return { rows, columns };
}
// A column is worth grouping by when it sorts the map into a handful of readable
// piles: at least two of them, and not so many that every node becomes its own.
function groupable(
  definition: Definition,
  filled: number,
  distinct: number,
  total: number,
) {
  if (definition.key === 'id' || definition.key === 'name') return false;
  if (definition.key === 'description' || definition.key === 'source')
    return false;
  if (!filled || distinct < 2) return false;
  if (definition.type === 'number') return distinct <= 25;
  return distinct <= Math.max(3, Math.round(total * 0.8));
}
export function cellText(value: CellValue | undefined): string {
  if (value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.join('; ');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}
export function compareCells(
  a: CellValue | undefined,
  b: CellValue | undefined,
  type: ColumnType,
) {
  if (isEmpty(a) && isEmpty(b)) return 0;
  if (isEmpty(a)) return 1;
  if (isEmpty(b)) return -1;
  if (type === 'number') return Number(b) - Number(a);
  return cellText(a).localeCompare(cellText(b));
}
// The group a row falls into for a given column. Lists join their first value so a
// node lands in exactly one pile; empty cells collect under one honest label.
export function groupOf(row: Row, key: string): string {
  const value = row.cells[key];
  if (isEmpty(value)) return 'Not recorded';
  if (Array.isArray(value)) return value[0] ?? 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key === 'hq') {
    const city = String(value).split(/\s*[,/]\s*/)[0]?.trim();
    if (city) return city;
  }
  return String(value);
}
function csvCell(value: CellValue | undefined) {
  const text = cellText(value);
  return /[",\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}
// Excel reads UTF-8 only when the file says so, and pandas ignores the mark.
export function toCsv(rows: Row[], columns: Column[]) {
  const header = columns.map((column) => csvCell(column.key)).join(',');
  const body = rows.map((row) =>
    columns.map((column) => csvCell(row.cells[column.key])).join(','),
  );
  return '﻿' + [header, ...body].join('\r\n') + '\r\n';
}
export function toRecords(rows: Row[], columns: Column[]) {
  return rows.map((row) =>
    Object.fromEntries(
      columns.map((column) => [column.key, row.cells[column.key] ?? null]),
    ),
  );
}
export type GraphFile = {
  version: number;
  generated: string;
  board: { id: string; name: string };
  nodes: Array<{
    id: string;
    label: string;
    kind: string;
    color: string;
    x: number;
    y: number;
    group?: string;
    attributes: Record<string, CellValue | null>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label: string;
    evidence: string;
    url: string;
    date: string;
    status: string;
  }>;
};
export function toGraph(
  table: Table,
  connections: Connection[],
  positions: Record<string, [number, number]>,
  board: { id: string; name: string },
  groupBy = '',
): GraphFile {
  const ids = new Set(table.rows.map((row) => row.id));
  return {
    version: 1,
    generated: new Date().toISOString(),
    board,
    nodes: table.rows.map((row) => ({
      id: row.id,
      label: row.entity.name,
      kind: row.entity.kind,
      color: row.entity.color,
      x: positions[row.id]?.[0] ?? 0,
      y: positions[row.id]?.[1] ?? 0,
      ...(groupBy ? { group: groupOf(row, groupBy) } : {}),
      attributes: Object.fromEntries(
        table.columns.map((column) => [
          column.key,
          row.cells[column.key] ?? null,
        ]),
      ),
    })),
    edges: connections
      .filter(
        (connection) => ids.has(connection.from) && ids.has(connection.to),
      )
      .map((connection) => ({
        id: connection.id,
        source: connection.from,
        target: connection.to,
        label: connection.label,
        evidence: connection.evidence,
        url: connection.url,
        date: connection.date,
        status: connection.status,
      })),
  };
}
