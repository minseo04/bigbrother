// A profile is optional. Without one a person can still read and, where a board
// allows it, suggest — they simply travel under a stable pseudonym.
import {authenticatedUser,unauthorized} from "@/lib/access";
import {contributorLabel,getProfile,saveProfile} from "@/lib/store";
function json(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});}
const visibilities=["public","handle_only","hidden"];
export async function GET(request:Request){
  const person=authenticatedUser(request);if(!person)return unauthorized();
  try{const profile=await getProfile(person);return json({profile:profile??null,label:await contributorLabel(person)});}
  catch(e){console.error("Profile read failed",e);return json({error:"Your profile is temporarily unavailable. Please retry."},503)}
}
export async function POST(request:Request){
  const person=authenticatedUser(request);if(!person)return unauthorized();
  const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return json({error:"Request origin is not allowed."},403);
  if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"JSON is required."},415);
  let b:Record<string,unknown>;
  try{const parsed:unknown=JSON.parse(await request.text());if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error();b=parsed as Record<string,unknown>;}
  catch{return json({error:"Invalid request."},400)}
  const handle=typeof b.handle==="string"?b.handle.trim():"",displayName=typeof b.displayName==="string"?b.displayName.trim():"",bio=typeof b.bio==="string"?b.bio.trim().slice(0,300):"";
  const visibility=typeof b.visibility==="string"&&visibilities.includes(b.visibility)?b.visibility:"handle_only";
  if(!/^[a-z0-9_-]{3,24}$/i.test(handle))return json({error:"Choose a handle of 3–24 letters, digits, hyphens or underscores."},400);
  if(displayName.length<1||displayName.length>60)return json({error:"Give a display name of 1–60 characters."},400);
  try{await saveProfile(person,{handle,displayName,bio,visibility});return json({ok:true,label:await contributorLabel(person)});}
  catch(e){const message=e instanceof Error?e.message:"";console.error("Profile save failed",e);return message.startsWith("That handle")?json({error:message},409):json({error:"Your profile could not be saved. Please retry."},503)}
}
