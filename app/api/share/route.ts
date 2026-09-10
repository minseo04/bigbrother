import {authenticatedUser,unauthorized} from "@/lib/access";
import {createShare,initialize,listShares,renameShare,revokeShare} from "@/lib/store";
function json(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});}
export async function GET(request:Request){const owner=authenticatedUser(request);if(!owner)return unauthorized();try{await initialize(owner);return json({shares:await listShares(owner)});}catch(e){console.error("Share list failed",e);return json({error:"Your share links are temporarily unavailable. Please retry."},503)}}
export async function POST(request:Request){
const owner=authenticatedUser(request);if(!owner)return unauthorized();
const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return json({error:"Request origin is not allowed."},403);
if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"JSON is required."},415);
let b:Record<string,unknown>;try{const raw=await request.text();if(raw.length>2000)return json({error:"Request is too large."},413);b=JSON.parse(raw) as Record<string,unknown>;if(!b||typeof b!=="object"||Array.isArray(b))throw Error();}catch{return json({error:"Invalid request."},400)}
try{await initialize(owner);
if(b.action==="create"){if(typeof b.boardId!=="string"||!b.boardId)return json({error:"Choose a board to share."},400);const token=await createShare(owner,b.boardId);if(!token)return json({error:"That board no longer exists."},404);return json({ok:true,token},201);}
if(b.action==="revoke"){if(typeof b.token!=="string"||!b.token)return json({error:"Choose a link to revoke."},400);const done=await revokeShare(owner,b.token);return done?json({ok:true}):json({error:"That link has already been revoked."},404);}
if(b.action==="rename"){const title=typeof b.title==="string"?b.title.trim():"";if(typeof b.token!=="string"||!b.token||title.length<1||title.length>60)return json({error:"Name the shared board in 1–60 characters."},400);const done=await renameShare(owner,b.token,title);return done?json({ok:true}):json({error:"That link has already been revoked."},404);}
return json({error:"Unknown action."},400);
}catch(e){console.error("Share update failed",e);const message=e instanceof Error&&e.message.startsWith("This workspace")?e.message:"";return message?json({error:message},400):json({error:"The share link could not be saved. Please retry."},503)}
}
