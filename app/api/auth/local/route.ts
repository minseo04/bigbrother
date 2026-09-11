import {authMethods, sessionCookie} from "@/lib/session";

export function GET() {
  if (!authMethods().local) {
    return Response.json({error: "Local sign-in is off. Set AUTH_ALLOW_LOCAL=1 or use GitHub."}, {status: 404});
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": sessionCookie("local_seedy"),
      "Cache-Control": "no-store",
    },
  });
}
