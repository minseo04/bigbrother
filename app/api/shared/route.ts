// The public half of sharing: the token in the query is the only credential for
// reading, and nothing here can write to the workspace it reads. Whether the token
// opens at all, and whether this reader may suggest anything, is the board's call.
import {authenticatedUser} from "@/lib/access";
import {recordShareView,shareTarget,sharedProject} from "@/lib/store";
import {boardPolicy,canPropose,canView,roleFor} from "@/lib/permissions";
function json(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store"}});}
const gone={error:"This share link has been revoked, or the board behind it was deleted."};
export async function GET(request:Request){
  const token=new URL(request.url).searchParams.get("token")??"";
  if(!/^[0-9a-f]{32}$/.test(token))return json({error:"This share link is not valid. Ask whoever sent it for a current link."},404);
  try{
    const target=await shareTarget(token);
    if(!target)return json(gone,404);
    const policy=await boardPolicy(target.ownerId,target.boardId);
    if(!policy)return json(gone,404);
    const viewer=authenticatedUser(request),role=await roleFor(policy,viewer);
    if(!canView(policy,role))return json({error:"This board is private. Its owner has closed the link."},404);
    const project=await sharedProject(token);
    if(!project)return json(gone,404);
    const propose=await canPropose(policy,viewer,role);
    await recordShareView(token).catch(()=>{});
    return json({...project,viewer:{signedIn:Boolean(viewer),role,canPropose:propose.ok,proposeError:propose.ok?"":propose.error}});
  }catch(e){console.error("Shared read failed",e);return json({error:"The shared board is temporarily unavailable. Please retry."},503)}
}
