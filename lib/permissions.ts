// Until now one line — owner_id=? — was the whole access model. A public board has
// three more questions to answer, so they live here rather than being spelled out
// again in every handler.
import {database} from "./store";

export type BoardPolicy={ownerId:string;boardId:string;name:string;visibility:string;proposalAudience:string};
export type Role="owner"|"collaborator"|"allowed"|null;
export const visibilities=["private","link","public"] as const;
export const audiences=["none","anyone","profiles","allowlist"] as const;

export async function boardPolicy(owner:string,boardId:string):Promise<BoardPolicy|null>{
  const row=await database().prepare("SELECT name,visibility,proposal_audience AS proposalAudience FROM boards WHERE owner_id=? AND id=?").bind(owner,boardId).first<{name:string;visibility:string;proposalAudience:string}>();
  return row?{ownerId:owner,boardId,name:row.name,visibility:row.visibility,proposalAudience:row.proposalAudience}:null;
}
export async function roleFor(policy:BoardPolicy,person:string|null):Promise<Role>{
  if(!person)return null;
  if(person===policy.ownerId)return "owner";
  const row=await database().prepare("SELECT role FROM board_access WHERE owner_id=? AND board_id=? AND person_id=?").bind(policy.ownerId,policy.boardId,person).first<{role:string}>();
  return row?.role==="collaborator"?"collaborator":row?.role==="allowed"?"allowed":null;
}
// A token addresses a board; whether it opens is still the board's decision.
export function canView(policy:BoardPolicy,role:Role){
  if(role==="owner"||role==="collaborator")return true;
  return policy.visibility!=="private";
}
export function canEdit(role:Role){return role==="owner"||role==="collaborator";}
export async function canPropose(policy:BoardPolicy,person:string|null,role:Role){
  if(role==="owner"||role==="collaborator")return {ok:true as const};
  if(!person)return {ok:false as const,error:"Sign in to suggest a change to this board."};
  if(policy.visibility!=="public")return {ok:false as const,error:"This board is shared for reading only."};
  if(policy.proposalAudience==="none")return {ok:false as const,error:"This board is not taking suggestions."};
  if(policy.proposalAudience==="anyone")return {ok:true as const};
  if(policy.proposalAudience==="allowlist")return role==="allowed"?{ok:true as const}:{ok:false as const,error:"Only people this board has invited can suggest changes."};
  const profile=await database().prepare("SELECT visibility FROM profiles WHERE owner_id=?").bind(person).first<{visibility:string}>();
  return profile?.visibility==="public"?{ok:true as const}:{ok:false as const,error:"This board takes suggestions from public profiles. Make your profile public to send one."};
}
