// Sites dispatch validates sign-in, strips visitor-supplied identity headers,
// and injects this stable, site-scoped identity. Direct anonymous API calls fail closed.
export function authenticatedUser(request:Request):string|null {
 const id=request.headers.get("oai-authenticated-user-id");
 return id&&id.length<=200?id:null;
}
export function unauthorized(){return Response.json({error:"Sign in to your private Site to load the workspace."},{status:401,headers:{"Cache-Control":"no-store"}});}

