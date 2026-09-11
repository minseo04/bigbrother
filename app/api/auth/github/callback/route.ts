import {authMethods, clearOAuthStateCookie, readOAuthState, sessionCookie} from "@/lib/session";

export async function GET(request: Request) {
  if (!authMethods().github) {
    return Response.json({error: "GitHub sign-in is not configured."}, {status: 404});
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const expected = readOAuthState(request);
  if (!code || !state || !expected || state !== expected) {
    return Response.json({error: "GitHub sign-in did not complete. Try again."}, {status: 400});
  }
  const origin = url.origin;
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {Accept: "application/json", "Content-Type": "application/json"},
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${origin}/api/auth/github/callback`,
    }),
  });
  const tokenBody = await tokenResponse.json() as {access_token?: string; error?: string};
  if (!tokenBody.access_token) {
    return Response.json({error: "GitHub would not issue a session. Try again."}, {status: 401});
  }
  const userResponse = await fetch("https://api.github.com/user", {
    headers: {Accept: "application/vnd.github+json", Authorization: `Bearer ${tokenBody.access_token}`, "User-Agent": "bigbrother"},
  });
  const user = await userResponse.json() as {id?: number};
  if (!user.id) {
    return Response.json({error: "GitHub did not return an account. Try again."}, {status: 401});
  }
  const headers = new Headers({
    Location: "/",
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", sessionCookie("github:" + String(user.id)));
  headers.append("Set-Cookie", clearOAuthStateCookie());
  return new Response(null, {status: 302, headers});
}
