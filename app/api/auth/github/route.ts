import {authMethods, oauthStateCookie, randomToken} from "@/lib/session";

export function GET(request: Request) {
  const id = process.env.GITHUB_CLIENT_ID;
  if (!authMethods().github || !id) {
    return Response.json({error: "GitHub sign-in is not configured."}, {status: 404});
  }
  const state = randomToken();
  const callback = new URL("/api/auth/github/callback", request.url);
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", id);
  authorize.searchParams.set("redirect_uri", callback.toString());
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      "Set-Cookie": oauthStateCookie(state),
      "Cache-Control": "no-store",
    },
  });
}
