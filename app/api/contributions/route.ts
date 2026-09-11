// The suggestion layer. A reader of a public board writes here; nothing they write
// touches the workspace until its owner accepts it, and every suggestion carries a
// source and the label its author chose to travel under.
import {authenticatedUser,unauthorized} from "@/lib/access";
import {contributionKinds,contributorLabel,createContribution,decideContribution,initialize,listContributions,shareTarget} from "@/lib/store";
import {boardPolicy,canEdit,canPropose,roleFor} from "@/lib/permissions";
import {safeWebUrl} from "@/lib/intelligence";
function json(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});}
function isKind(value:unknown):value is (typeof contributionKinds)[number]{return typeof value==="string"&&(contributionKinds as readonly string[]).includes(value);}
export async function GET(request:Request){
  const person=authenticatedUser(request);if(!person)return unauthorized();
  const params=new URL(request.url).searchParams,boardId=params.get("board")??"",status=params.get("status")==="decided"?"accepted":"pending";
  if(!boardId)return json({error:"Choose a board."},400);
  try{
    await initialize(person);
    const policy=await boardPolicy(person,boardId);
    if(!policy)return json({error:"That board no longer exists."},404);
    return json({contributions:await listContributions(person,boardId,status)});
  }catch(e){console.error("Inbox read failed",e);return json({error:"The suggestions are temporarily unavailable. Please retry."},503)}
}
export async function POST(request:Request){
  const person=authenticatedUser(request);if(!person)return unauthorized();
  const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return json({error:"Request origin is not allowed."},403);
  if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"JSON is required."},415);
  let b:Record<string,unknown>;
  try{const raw=await request.text();if(raw.length>4000)return json({error:"Request is too large."},413);const parsed:unknown=JSON.parse(raw);if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error();b=parsed as Record<string,unknown>;}
  catch{return json({error:"Invalid request."},400)}
  const token=typeof b.token==="string"?b.token:"";
  if(!/^[0-9a-f]{32}$/.test(token))return json({error:"Open the board through its share link to suggest a change."},400);
  if(!isKind(b.kind))return json({error:"Choose what you are suggesting: an attribute, a connection, an entity, or a source."},400);
  const evidenceUrl=safeWebUrl(b.evidenceUrl);
  if(!evidenceUrl)return json({error:"Every suggestion needs a public source URL that backs it."},400);
  const message=typeof b.message==="string"?b.message.trim().slice(0,600):"";
  const payload=b.payload&&typeof b.payload==="object"&&!Array.isArray(b.payload)?b.payload as Record<string,unknown>:{};
  const invalid=describe(b.kind,payload);
  if(invalid)return json({error:invalid},400);
  try{
    const target=await shareTarget(token);
    if(!target)return json({error:"That share link has been revoked."},404);
    const policy=await boardPolicy(target.ownerId,target.boardId);
    if(!policy)return json({error:"That board no longer exists."},404);
    const role=await roleFor(policy,person),allowed=await canPropose(policy,person,role);
    if(!allowed.ok)return json({error:allowed.error},403);
    const id=await createContribution(target.ownerId,target.boardId,{
      kind:b.kind,
      targetId:typeof b.targetId==="string"?b.targetId:"",
      payload,evidenceUrl,message,
      contributor:person,
      contributorLabel:await contributorLabel(person)
    });
    return json({ok:true,id},201);
  }catch(e){const message=e instanceof Error?e.message:"";console.error("Suggestion failed",e);return message.startsWith("This board")||message.startsWith("You have")?json({error:message},400):json({error:"The suggestion could not be sent. Please retry."},503)}
}
function describe(kind:string,payload:Record<string,unknown>){
  const value=(key:string)=>typeof payload[key]==="string"?(payload[key] as string).trim():"";
  if(kind==="attribute")return value("entityId")&&value("key")&&value("value")?"":"Name the entity, the attribute and the value it should hold.";
  if(kind==="connection")return value("from")&&value("to")&&value("from")!==value("to")&&value("label")&&value("evidence")&&/^\d{4}-\d{2}-\d{2}$/.test(value("date"))?"":"Choose two different entities, say what connects them, and give the evidence and its date.";
  if(kind==="entity")return value("name").length>=2?"":"Give the entity a name of at least two characters.";
  if(kind==="source")return value("connectionId")?"":"Choose the connection this source supports.";
  return "Unknown suggestion.";
}
export async function PATCH(request:Request){
  const person=authenticatedUser(request);if(!person)return unauthorized();
  const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return json({error:"Request origin is not allowed."},403);
  if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"JSON is required."},415);
  let b:Record<string,unknown>;
  try{const parsed:unknown=JSON.parse(await request.text());if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error();b=parsed as Record<string,unknown>;}
  catch{return json({error:"Invalid request."},400)}
  const id=typeof b.id==="string"?b.id:"",boardId=typeof b.boardId==="string"?b.boardId:"";
  if(!id||!boardId||(b.decision!=="accept"&&b.decision!=="decline"))return json({error:"Choose a suggestion and whether to accept it."},400);
  try{
    await initialize(person);
    const policy=await boardPolicy(person,boardId);
    if(!policy)return json({error:"That board no longer exists."},404);
    if(!canEdit(await roleFor(policy,person)))return json({error:"Only this board's owner can decide on suggestions."},403);
    const result=await decideContribution(person,id,b.decision==="accept");
    return result.ok?json({ok:true}):json({error:result.error},400);
  }catch(e){console.error("Decision failed",e);return json({error:"The decision could not be saved. Please retry."},503)}
}
