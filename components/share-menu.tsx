"use client";
import {useState} from "react";
import {Check,Copy,ExternalLink,Link2,Share2,Trash2} from "lucide-react";
import {Popover,PopoverContent,PopoverTrigger} from "@/components/ui/popover";
type Share={token:string;boardId:string;title:string;created:string;views:number;lastViewed:string};
type Access={personId:string;role:string;handle:string|null;displayName:string|null};
const visibilityChoices:[string,string][]=[["private","Private — the link is closed"],["link","Link — anyone with it can read"],["public","Public — readers can suggest changes"]];
const audienceChoices:[string,string][]=[["none","Nobody"],["anyone","Anyone signed in"],["profiles","People with a public profile"],["allowlist","Only people I invite"]];
async function shareApi(body?:unknown){
  const response=await fetch("/api/share",{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
  const data=await response.json() as {error?:string;[key:string]:unknown};
  if(!response.ok)throw new Error(data.error??"Unable to complete the request.");
  return data;
}
export function ShareMenu({boardId,boardName,visibility,proposalAudience,onPolicy}:{boardId:string;boardName:string;visibility:string;proposalAudience:string;onPolicy:(change:{visibility?:string;proposalAudience?:string})=>Promise<void>}){
  const[share,setShare]=useState<Share|null>(null),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false),[error,setError]=useState(""),[access,setAccess]=useState<Access[]>([]),[handle,setHandle]=useState(""),[role,setRole]=useState("allowed");
  const url=share?(typeof location==="undefined"?"":location.origin)+"/s/"+share.token:"";
  async function open(next:boolean){
    if(!next)return;
    setError("");setCopied(false);
    try{
      const data=await shareApi() as {shares:Share[]};
      setShare(data.shares.find(item=>item.boardId===boardId)??null);
      const list=await fetch("/api/workspace?access="+encodeURIComponent(boardId)).then(response=>response.json() as Promise<{access?:Access[]}>).catch(()=>({access:[]}));
      setAccess(list.access??[]);
      setLoaded(true);
    }
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
  async function invite(event:{preventDefault():void}){
    event.preventDefault();setBusy(true);setError("");
    try{
      const response=await fetch("/api/workspace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"access-add",boardId,handle:handle.trim(),role})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error??"They could not be added.");
      setHandle("");
      const list=await fetch("/api/workspace?access="+encodeURIComponent(boardId)).then(next=>next.json() as Promise<{access?:Access[]}>);
      setAccess(list.access??[]);
    }catch(cause){setError(cause instanceof Error?cause.message:"They could not be added.")}
    finally{setBusy(false)}
  }
  async function uninvite(personId:string){
    setError("");
    try{
      await fetch("/api/workspace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"access-remove",boardId,personId})});
      setAccess(current=>current.filter(item=>item.personId!==personId));
    }catch{setError("They could not be removed.")}
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
      <div className="share-policy">
        <label>Who can open it
          <select value={visibility} onChange={event=>void onPolicy({visibility:event.target.value})}>
            {visibilityChoices.map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {visibility==="public"&&<label>Who can suggest changes
          <select value={proposalAudience} onChange={event=>void onPolicy({proposalAudience:event.target.value})}>
            {audienceChoices.map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </label>}
        {visibility==="public"&&<>
          <form className="share-invite" onSubmit={event=>void invite(event)}>
            <input value={handle} onChange={event=>setHandle(event.target.value)} placeholder="handle" aria-label="Handle to invite"/>
            <select value={role} onChange={event=>setRole(event.target.value)} aria-label="What they may do">
              <option value="allowed">May suggest</option>
              <option value="collaborator">May edit directly</option>
            </select>
            <button className="secondary-button" type="submit" disabled={busy||!handle.trim()}>Invite</button>
          </form>
          {access.length>0&&<ul className="share-access">
            {access.map(person=><li key={person.personId}>
              <span>{person.displayName??person.handle??"Someone"}</span>
              <small>{person.role==="collaborator"?"edits directly":"suggests"}</small>
              <button type="button" onClick={()=>void uninvite(person.personId)} aria-label="Remove">×</button>
            </li>)}
          </ul>}
        </>}
      </div>
      {error&&<p className="form-error" role="alert">{error}</p>}
    </PopoverContent>
  </Popover>;
}
