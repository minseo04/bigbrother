import {authMethods, passwordMatches, sessionCookie} from "@/lib/session";

export async function POST(request: Request) {
  if (!authMethods().password) {
    return Response.json({error: "Password sign-in is not configured."}, {status: 404});
  }
  let body: {password?: unknown};
  try { body = await request.json() as {password?: unknown}; }
  catch { return Response.json({error: "Invalid request."}, {status: 400}); }
  const password = typeof body.password === "string" ? body.password : "";
  if (!passwordMatches(password)) {
    return Response.json({error: "That password is not right."}, {status: 401});
  }
  const id = process.env.AUTH_USER_ID?.trim() || "owner";
  return Response.json({ok: true}, {
    headers: {
      "Set-Cookie": sessionCookie(id.slice(0, 200)),
      "Cache-Control": "no-store",
    },
  });
}
