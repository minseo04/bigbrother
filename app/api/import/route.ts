import {authenticatedUser, unauthorized} from "@/lib/access";
import {importDataframe} from "@/lib/store";
import {importLimits, planImport, type StringRow} from "@/lib/import-file";
import {publicOrigin} from "@/lib/session";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {status, headers: {"Cache-Control": "private, no-store"}});
}

function stringRows(value: unknown): StringRow[] | null {
  if (!Array.isArray(value) || value.length > importLimits.rows) return null;
  const rows: StringRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row: StringRow = {};
    const entries = Object.entries(item as Record<string, unknown>);
    if (entries.length > 60) return null;
    for (const [key, cell] of entries) {
      if (typeof key !== "string" || key.length > 40) return null;
      if (cell === null || cell === undefined) row[key] = "";
      else if (typeof cell === "string") row[key] = cell.slice(0, 2000);
      else if (typeof cell === "number" || typeof cell === "boolean") row[key] = String(cell);
      else return null;
    }
    rows.push(row);
  }
  return rows;
}

export async function POST(request: Request) {
  const owner = authenticatedUser(request);
  if (!owner) return unauthorized();
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
    const allowed = new Set([new URL(request.url).origin, publicOrigin(request)]);
    if (host) allowed.add(`${proto}://${host.split(",")[0]!.trim()}`);
    if (!allowed.has(origin)) return json({error: "Request origin is not allowed."}, 403);
  }
  if (!request.headers.get("content-type")?.includes("application/json")) return json({error: "JSON is required."}, 415);
  let body: {name?: unknown; nodes?: unknown; edges?: unknown};
  try {
    const raw = await request.text();
    if (raw.length > importLimits.fileChars) return json({error: "That file is too large."}, 413);
    body = JSON.parse(raw) as {name?: unknown; nodes?: unknown; edges?: unknown};
  } catch {
    return json({error: "Invalid request."}, 400);
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const nodes = stringRows(body.nodes);
  const edges = body.edges === undefined ? [] : stringRows(body.edges);
  if (!name || !nodes || !edges) return json({error: "Upload a table of rows. CSV and JSON dataframes both work."}, 400);
  try {
    const plan = planImport(name, nodes, edges);
    const result = await importDataframe(owner, plan);
    return json({ok: true, ...result}, 201);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The file could not be imported.";
    if (message.startsWith("Each row") || message.startsWith("This workspace") || message.startsWith("That file")) {
      return json({error: message}, 400);
    }
    console.error("Import failed", cause);
    return json({error: "The file could not be imported. Please retry."}, 503);
  }
}
