"use client";
import {useState} from "react";
import {Check,Copy,ExternalLink,Link2,Share2,Trash2} from "lucide-react";
import {Popover,PopoverContent,PopoverTrigger} from "@/components/ui/popover";
type Share={token:string;boardId:string;title:string;created:string;views:number;lastViewed:string};
async function shareApi(body?:unknown){
  const response=await fetch("/api/share",{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
  const data=await response.json() as {error?:string;[key:string]:unknown};
  if(!response.ok)throw new Error(data.error??"Unable to complete the request.");
  return data;
}
export function ShareMenu({boardId,boardName}:{boardId:string;boardName:string}){
  const[share,setShare]=useState<Share|null>(null),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false),[error,setError]=useState("");
  const url=share?(typeof location==="undefined"?"":location.origin)+"/s/"+share.token:"";
  async function open(next:boolean){
    if(!next)return;
    setError("");setCopied(false);
    try{const data=await shareApi() as {shares:Share[]};setShare(data.shares.find(item=>item.boardId===boardId)??null);setLoaded(true)}
    catch(cause){setError(cause instanceof Error?cause.message:"Your share links could not be loaded.");setLoaded(true)}
  }
  async function create(){
    setBusy(true);setError("");
    try{const data=await shareApi({action:"create",boardId}) as {token:string};setShare({token:data.token,boardId,title:boardName,created:new Date().toISOString(),views:0,lastViewed:""})}
    catch(cause){setError(cause instanceof Error?cause.message:"The link could not be created.")}
    finally{setBusy(false)}
  }
  async function revoke(){
    if(!share)return;
    setBusy(true);setError("");
    try{await shareApi({action:"revoke",token:share.token});setShare(null);setCopied(false)}
    catch(cause){setError(cause instanceof Error?cause.message:"The link could not be revoked.")}
    finally{setBusy(false)}
  }
  async function copy(){
    try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2500)}
    catch{setError("Copying was blocked. Select the link and copy it by hand.")}
  }
  return <Popover onOpenChange={next=>void open(next)}>
    <PopoverTrigger className="board-share" aria-label="Share this board"><Share2 size={14}/> Share</PopoverTrigger>
    <PopoverContent className="share-popover" align="end" sideOffset={8}>
      <header><Link2 size={14}/><strong>Share “{boardName}”</strong></header>
      <p>Anyone holding the link can read this board — its entities, connections, and the source behind each one. They cannot change anything, and your notes stay private.</p>
      {!loaded&&<p className="share-status">Checking for an existing link…</p>}
      {loaded&&!share&&<button className="primary-button" type="button" disabled={busy} onClick={()=>void create()}>{busy?"Creating…":"Create a read-only link"}</button>}
      {share&&<>
        <div className="share-link">
          <input readOnly value={url} aria-label="Share link" onFocus={event=>event.target.select()}/>
          <button type="button" onClick={()=>void copy()} aria-label="Copy link">{copied?<Check size={14}/>:<Copy size={14}/>}</button>
        </div>
        <div className="share-actions">
          <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/> Open the shared view</a>
          <span>{share.views} {share.views===1?"view":"views"}</span>
        </div>
        <button className="text-button share-revoke" type="button" disabled={busy} onClick={()=>void revoke()}><Trash2 size={13}/> {busy?"Revoking…":"Revoke this link"}</button>
      </>}
      {error&&<p className="form-error" role="alert">{error}</p>}
    </PopoverContent>
  </Popover>;
}
