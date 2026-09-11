import {authMethods, clearOAuthStateCookie, publicOrigin, readOAuthState, sessionCookie} from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authMethods().google) {
    return Response.json({error: "Google sign-in is not configured."}, {status: 404});
  }
  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return Response.json({error: "Google sign-in was cancelled. Try again."}, {status: 400});
  }
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const expected = readOAuthState(request);
  if (!code || !state || !expected || state !== expected) {
    return Response.json({error: "Google sign-in did not complete. Try again."}, {status: 400});
  }
  const origin = publicOrigin(request);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  const tokenBody = await tokenResponse.json() as {access_token?: string; error?: string};
  if (!tokenBody.access_token) {
    return Response.json({error: "Google would not issue a session. Try again."}, {status: 401});
  }
  const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {Authorization: `Bearer ${tokenBody.access_token}`},
  });
  const user = await userResponse.json() as {sub?: string};
  if (!user.sub) {
    return Response.json({error: "Google did not return an account. Try again."}, {status: 401});
  }
  const headers = new Headers({
    Location: "/",
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", sessionCookie("google:" + user.sub.slice(0, 190)));
  headers.append("Set-Cookie", clearOAuthStateCookie());
  return new Response(null, {status: 302, headers});
}
