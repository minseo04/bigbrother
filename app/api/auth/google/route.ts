import {authMethods, oauthStateCookie, publicOrigin, randomToken} from "@/lib/session";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!authMethods().google || !id) {
    return Response.json({error: "Google sign-in is not configured."}, {status: 404});
  }
  const state = randomToken();
  const callback = `${publicOrigin(request)}/api/auth/google/callback`;
  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.searchParams.set("client_id", id);
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "openid email profile");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("prompt", "select_account");
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      "Set-Cookie": oauthStateCookie(state),
      "Cache-Control": "no-store",
    },
  });
}
