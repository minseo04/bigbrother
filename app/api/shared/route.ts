// The public half of sharing: no identity is required, the token in the query is the
// only credential, and nothing here can write to the workspace it reads.
import {recordShareView,sharedProject} from "@/lib/store";
function json(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store"}});}
export async function GET(request:Request){
  const token=new URL(request.url).searchParams.get("token")??"";
  if(!/^[0-9a-f]{32}$/.test(token))return json({error:"This share link is not valid. Ask whoever sent it for a current link."},404);
  try{
    const project=await sharedProject(token);
    if(!project)return json({error:"This share link has been revoked, or the board behind it was deleted."},404);
    await recordShareView(token).catch(()=>{});
    return json(project);
  }catch(e){console.error("Shared read failed",e);return json({error:"The shared board is temporarily unavailable. Please retry."},503)}
}
