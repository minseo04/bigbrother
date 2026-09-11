import {sessionUser} from "./session";

export function authenticatedUser(request: Request): string | null {
  return sessionUser(request);
}

export function unauthorized() {
  return Response.json(
    {error: "Sign in to load the workspace."},
    {status: 401, headers: {"Cache-Control": "no-store"}},
  );
}
