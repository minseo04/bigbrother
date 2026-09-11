import {authMethods} from "@/lib/session";

export function GET() {
  return Response.json(authMethods(), {headers: {"Cache-Control": "no-store"}});
}
