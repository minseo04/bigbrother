import {kindColor, safeWebUrl} from './intelligence';
import {normalizeKey} from './dataframe';

export const importLimits = {
  rows: 500,
  board: 100,
  fileChars: 350_000,
};

const nameKeys = [
  'name',
  'title',
  'label',
  'entity',
  'company',
  'person',
  'organisation',
  'organization',
  'node',
];
const kindKeys = ['kind', 'category', 'type', 'sector', 'vertical', 'layer'];
const idKeys = ['id', 'entityid', 'nodeid'];
const descriptionKeys = ['description', 'summary', 'about', 'bio'];
const sourceKeys = ['website', 'homepage', 'source', 'url'];
const aliasKeys = ['aliases', 'alias', 'aka'];
const fromKeys = ['source', 'from', 'sourceid'];
const toKeys = ['target', 'to', 'targetid'];
const fromNameKeys = ['sourcename', 'fromname'];
const toNameKeys = ['targetname', 'toname'];
const labelKeys = ['label', 'relationship', 'relation', 'edge'];
const reservedNode = new Set([
  ...nameKeys,
  ...kindKeys,
  ...idKeys,
  ...descriptionKeys,
  ...sourceKeys,
  ...aliasKeys,
  'x',
  'y',
  'followed',
  'following',
  'links',
  'notes',
  'image',
  'imageurl',
  'photo',
  'feed',
  'feedurl',
]);
const reservedEdge = new Set([
  ...fromKeys,
  ...toKeys,
  ...fromNameKeys,
  ...toNameKeys,
  ...labelKeys,
  'id',
  'status',
  'date',
  'url',
  'evidence',
]);

export type StringRow = Record<string, string>;
export type ParsedTable = {name: string; rows: StringRow[]};
export type ImportPlan = {
  name: string;
  entities: PlannedEntity[];
  connections: PlannedConnection[];
  truncated: number;
};
export type PlannedEntity = {
  id: string;
  name: string;
  kind: string;
  initials: string;
  description: string;
  aliases: string[];
  source: string;
  color: string;
  followed: boolean;
  image: string;
  feedUrl: string;
  x?: number;
  y?: number;
  attributes: Array<{key: string; value: string}>;
};
export type PlannedConnection = {
  from: string;
  to: string;
  label: string;
  evidence: string;
  url: string;
  date: string;
  status: 'Documented' | 'Hypothesis';
};

export function parseDelimited(text: string): StringRow[] {
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!source.trim()) return [];
  const first = source.split('\n').find((line) => line.trim()) ?? '';
  const commas = (first.match(/,/g) ?? []).length;
  const semis = (first.match(/;/g) ?? []).length;
  const tabs = (first.match(/\t/g) ?? []).length;
  const delimiter = tabs > commas && tabs > semis ? '\t' : semis > commas ? ';' : ',';
  const table = splitRecords(source, delimiter);
  if (table.length < 2) return [];
  const headers = table[0]!.map((header, index) => header.trim() || 'column' + (index + 1));
  return table.slice(1).map((cells) => {
    const row: StringRow = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim();
    });
    return row;
  }).filter((row) => Object.values(row).some((value) => value !== ''));
}

function splitRecords(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (char === '\n') {
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

export function parseJsonTable(text: string): StringRow[] {
  const data = JSON.parse(text) as unknown;
  if (Array.isArray(data)) return data.map(objectRow).filter((row) => Object.keys(row).length > 0);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.nodes) && record.nodes.every((item) => item && typeof item === 'object')) {
    return (record.nodes as unknown[]).map(objectRow);
  }
  if (Array.isArray(record.data) && Array.isArray(record.columns)) {
    const columns = record.columns.map((column) => String(column));
    return (record.data as unknown[]).map((item) => {
      const row: StringRow = {};
      if (Array.isArray(item)) {
        columns.forEach((column, index) => {
          row[column] = cellString(item[index]);
        });
      } else Object.assign(row, objectRow(item));
      return row;
    });
  }
  if (Array.isArray(record.data)) return (record.data as unknown[]).map(objectRow);
  if (Array.isArray(record.records)) return (record.records as unknown[]).map(objectRow);
  return [];
}

function objectRow(value: unknown): StringRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, cellString(item)]),
  );
}

function cellString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => cellString(item)).filter(Boolean).join('; ');
  return '';
}

export function parseTableText(name: string, text: string): ParsedTable {
  if (text.length > importLimits.fileChars) {
    throw new Error('That file is too large. Export a CSV or JSON of at most a few hundred rows.');
  }
  const lower = name.toLowerCase();
  if (/\.xlsx?$/.test(lower) || /\.ods$/.test(lower) || /\.parquet$/.test(lower)) {
    throw new Error('Save the sheet as CSV or JSON (one row per entity) and upload that.');
  }
  const rows = /\.json$/.test(lower) || text.trim().startsWith('{') || text.trim().startsWith('[')
    ? parseJsonTable(text)
    : parseDelimited(text);
  if (!rows.length) throw new Error('That file has no data rows.');
  return {name: boardName(name), rows: rows.slice(0, importLimits.rows)};
}

export function parseJsonEdges(text: string): StringRow[] {
  try {
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
    const edges = (data as {edges?: unknown}).edges;
    if (!Array.isArray(edges)) return [];
    return edges.map(objectRow);
  } catch {
    return [];
  }
}

export function isEdgeTable(rows: StringRow[]): boolean {
  if (!rows.length) return false;
  const keys = headerSet(rows[0]!);
  const ends =
    (hasAny(keys, fromKeys) && hasAny(keys, toKeys)) ||
    (hasAny(keys, fromNameKeys) && hasAny(keys, toNameKeys));
  if (!ends) return false;
  if (hasAny(keys, fromNameKeys) || keys.has('evidence') || keys.has('label')) return true;
  return !hasAny(keys, nameKeys);
}

function headerSet(row: StringRow) {
  return new Set(Object.keys(row).map(normalizeKey));
}
function hasAny(keys: Set<string>, aliases: string[]) {
  return aliases.some((alias) => keys.has(normalizeKey(alias)));
}
function pick(row: StringRow, aliases: string[]) {
  const values = new Map(Object.entries(row).map(([key, value]) => [normalizeKey(key), value.trim()]));
  for (const alias of aliases) {
    const value = values.get(normalizeKey(alias));
    if (value) return value;
  }
  return '';
}
function firstColumn(row: StringRow) {
  return Object.values(row).find((value) => value.trim())?.trim() ?? '';
}
export function boardName(filename: string) {
  const stem = filename.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').replace(/-nodes$/i, '').replace(/-edges$/i, '');
  const cleaned = stem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Imported board';
  return cleaned.slice(0, 60);
}
function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase() || '?';
}
function aliasesOf(name: string, raw: string) {
  const extra = raw
    .split(/[;|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([name, ...extra])];
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function parseDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))) return value;
  return today();
}
function numberCell(value: string) {
  if (value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

export function entitiesFromRows(rows: StringRow[], fallbackKind = 'Imported'): PlannedEntity[] {
  const used = new Set<string>();
  const entities: PlannedEntity[] = [];
  for (const row of rows) {
    const name = pick(row, nameKeys) || firstColumn(row);
    if (name.length < 2 || name.length > 100) continue;
    const kind = (pick(row, kindKeys) || fallbackKind).slice(0, 40) || fallbackKind;
    let id = slug(pick(row, idKeys)) || slug(name) || crypto.randomUUID();
    if (used.has(id)) id = crypto.randomUUID();
    used.add(id);
    const sourceValue = pick(row, sourceKeys);
    const source = safeWebUrl(sourceValue);
    const followedRaw = pick(row, ['followed', 'following']);
    entities.push({
      id,
      name,
      kind,
      initials: initialsOf(name),
      description: pick(row, descriptionKeys).slice(0, 400) || 'Imported from a dataframe.',
      aliases: aliasesOf(name, pick(row, aliasKeys)),
      source,
      color: kindColor(kind),
      followed: ['true', 'yes', '1'].includes(followedRaw.toLowerCase()),
      image: safeWebUrl(pick(row, ['image', 'imageurl', 'photo'])),
      feedUrl: safeWebUrl(pick(row, ['feed', 'feedurl'])),
      x: numberCell(pick(row, ['x'])),
      y: numberCell(pick(row, ['y'])),
      attributes: attributesOf(row, reservedNode),
    });
  }
  return entities;
}

function attributesOf(row: StringRow, reserved: Set<string>) {
  const seen = new Set<string>();
  const attributes: Array<{key: string; value: string}> = [];
  for (const [rawKey, rawValue] of Object.entries(row)) {
    const key = rawKey.trim().slice(0, 40);
    const value = rawValue.trim().slice(0, 200);
    const normalized = normalizeKey(key);
    if (!key || !value || reserved.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    if (attributes.length >= 40) break;
    attributes.push({key, value});
  }
  return attributes;
}

export function connectionsFromRows(
  rows: StringRow[],
  entities: PlannedEntity[],
): PlannedConnection[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const byName = new Map(entities.map((entity) => [entity.name.toLowerCase(), entity]));
  const connections: PlannedConnection[] = [];
  const seen = new Set<string>();
  function resolve(row: StringRow, ids: string[], names: string[]) {
    const id = pick(row, ids);
    const name = pick(row, names);
    return byId.get(id) ?? byName.get(id.toLowerCase()) ?? byName.get(name.toLowerCase()) ?? null;
  }
  for (const row of rows) {
    const from = resolve(row, fromKeys, fromNameKeys);
    const to = resolve(row, toKeys, toNameKeys);
    if (!from || !to || from.id === to.id) continue;
    const key = from.id + '>' + to.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const url = safeWebUrl(pick(row, ['url', 'sourceurl', 'evidenceurl']));
    const evidence = pick(row, ['evidence']).slice(0, 1200) || 'Imported from a dataframe.';
    const label = (pick(row, labelKeys) || 'related').slice(0, 100);
    const status = pick(row, ['status']).toLowerCase() === 'documented' && url ? 'Documented' : 'Hypothesis';
    connections.push({
      from: from.id,
      to: to.id,
      label,
      evidence,
      url,
      date: parseDate(pick(row, ['date'])),
      status,
    });
  }
  return connections;
}

export function nodesFromEdgeRows(rows: StringRow[]): StringRow[] {
  const seen = new Map<string, StringRow>();
  function take(row: StringRow, ids: string[], names: string[]) {
    const id = pick(row, ids);
    const name = pick(row, names) || id;
    if (!name) return;
    const key = (id || name).toLowerCase();
    if (seen.has(key)) return;
    seen.set(key, {id: id || slug(name), name, kind: 'Imported'});
  }
  for (const row of rows) {
    take(row, fromKeys, fromNameKeys);
    take(row, toKeys, toNameKeys);
  }
  return [...seen.values()];
}

export function planImport(
  name: string,
  nodeRows: StringRow[],
  edgeRows: StringRow[] = [],
): ImportPlan {
  const truncated = Math.max(0, nodeRows.length - importLimits.rows);
  const table = nodeRows.slice(0, importLimits.rows);
  const edgeTable = edgeRows.length ? edgeRows : isEdgeTable(table) ? table : [];
  const entityRows = edgeTable === table ? nodesFromEdgeRows(table) : table;
  const entities = entitiesFromRows(entityRows);
  if (!entities.length) {
    throw new Error('Each row needs a name. Use a Name column, or put the entity in the first column.');
  }
  const connections = connectionsFromRows(edgeTable, entities);
  return {name: boardName(name), entities, connections, truncated};
}

export function combineTables(files: ParsedTable[]): {name: string; nodes: StringRow[]; edges: StringRow[]} {
  if (!files.length) throw new Error('Choose a CSV or JSON file.');
  const edges = files.filter((file) => isEdgeTable(file.rows));
  const nodes = files.filter((file) => !isEdgeTable(file.rows));
  if (nodes.length && edges.length) {
    return {name: nodes[0]!.name, nodes: nodes.flatMap((file) => file.rows), edges: edges.flatMap((file) => file.rows)};
  }
  if (edges.length && !nodes.length) {
    const rows = edges.flatMap((file) => file.rows);
    return {name: edges[0]!.name, nodes: nodesFromEdgeRows(rows), edges: rows};
  }
  return {name: files[0]!.name, nodes: files.flatMap((file) => file.rows), edges: []};
}

export async function readImportFiles(files: File[]): Promise<{name: string; nodes: StringRow[]; edges: StringRow[]}> {
  if (!files.length) throw new Error('Choose a CSV or JSON file.');
  const tables: ParsedTable[] = [];
  let jsonEdges: StringRow[] = [];
  for (const file of files) {
    const text = await file.text();
    if (/\.json$/i.test(file.name)) jsonEdges = [...jsonEdges, ...parseJsonEdges(text)];
    tables.push(parseTableText(file.name, text));
  }
  const combined = combineTables(tables);
  return {name: combined.name, nodes: combined.nodes, edges: [...combined.edges, ...jsonEdges]};
}
