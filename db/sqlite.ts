import {createClient, type Client, type InValue} from "@libsql/client";
import {mkdirSync, readFileSync} from "node:fs";
import path from "node:path";
import journal from "../drizzle/meta/_journal.json";

export type SqliteStatement = {
  sql: string;
  args: InValue[];
  bind(...args: InValue[]): SqliteStatement;
  first<T=Record<string, unknown>>(): Promise<T | null>;
  all<T=Record<string, unknown>>(): Promise<{results: T[]}>;
  run(): Promise<{meta: {changes: number}}>;
};

export type SqliteDatabase = {
  prepare(sql: string): SqliteStatement;
  batch(statements: SqliteStatement[]): Promise<unknown>;
};

let client: Client | null = null;
let migrating: Promise<void> | null = null;
let adapter: SqliteDatabase | null = null;

function databaseUrl() {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  if (url) return url;
  mkdirSync("data", {recursive: true});
  return "file:data/bigbrother.db";
}

function getClient() {
  if (client) return client;
  const url = databaseUrl();
  const authToken = process.env.TURSO_AUTH_TOKEN;
  client = createClient(url.startsWith("file:") ? {url} : {url, authToken});
  return client;
}

async function migrate(target: Client) {
  await target.execute("CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY)");
  const applied = await target.execute("SELECT id FROM _migrations");
  const done = new Set(applied.rows.map(row => String(row.id)));
  const folder = path.join(process.cwd(), "drizzle");
  for (const entry of journal.entries) {
    if (done.has(entry.tag)) continue;
    const sql = readFileSync(path.join(folder, `${entry.tag}.sql`), "utf8");
    const statements = sql.split("--> statement-breakpoint").map(part => part.trim()).filter(Boolean);
    for (const statement of statements) await target.execute(statement);
    await target.execute({sql: "INSERT INTO _migrations (id) VALUES (?)", args: [entry.tag]});
  }
}

function ensureMigrated() {
  if (!migrating) migrating = migrate(getClient()).catch(error => {
    migrating = null;
    throw error;
  });
  return migrating;
}

class Statement implements SqliteStatement {
  constructor(readonly sql: string, readonly args: InValue[] = []) {}
  bind(...args: InValue[]) { return new Statement(this.sql, args); }
  async first<T=Record<string, unknown>>() {
    await ensureMigrated();
    const result = await getClient().execute({sql: this.sql, args: this.args});
    return (result.rows[0] as T | undefined) ?? null;
  }
  async all<T=Record<string, unknown>>() {
    await ensureMigrated();
    const result = await getClient().execute({sql: this.sql, args: this.args});
    return {results: result.rows as T[]};
  }
  async run() {
    await ensureMigrated();
    const result = await getClient().execute({sql: this.sql, args: this.args});
    return {meta: {changes: result.rowsAffected}};
  }
}

export function database(): SqliteDatabase {
  if (adapter) return adapter;
  adapter = {
    prepare(sql: string) { return new Statement(sql); },
    async batch(statements: SqliteStatement[]) {
      await ensureMigrated();
      if (!statements.length) return;
      await getClient().batch(statements.map(statement => ({sql: statement.sql, args: statement.args})));
    },
  };
  return adapter;
}
