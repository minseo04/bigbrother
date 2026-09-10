"use client";
// How a person appears when they suggest something. Optional everywhere: without one
// they still read, and where a board allows it they still suggest, under a stable
// pseudonym rather than their account identity.
import {useEffect,useState} from "react";
import {UserRound} from "lucide-react";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "@/components/ui/dialog";
type Profile={handle:string;displayName:string;bio:string;visibility:string};
const choices:[string,string][]=[["public","Public — my name is shown"],["handle_only","Handle only — @handle is shown"],["hidden","Hidden — a stable pseudonym is shown"]];
export function ProfileCard({onSaved}:{onSaved?:(label:string)=>void}){
  const[open,setOpen]=useState(false),[label,setLabel]=useState(""),[profile,setProfile]=useState<Profile>({handle:"",displayName:"",bio:"",visibility:"handle_only"}),[busy,setBusy]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState(false);
  useEffect(()=>{
    void fetch("/api/profile").then(async response=>{
      if(!response.ok)return;
      const data=await response.json() as {profile:Profile|null;label:string};
      setLabel(data.label);
      if(data.profile)setProfile(data.profile);
    }).catch(()=>{});
  },[]);
  async function save(event:{preventDefault():void}){
    event.preventDefault();setBusy(true);setError("");setSaved(false);
    try{
      const response=await fetch("/api/profile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(profile)});
      const data=await response.json() as {error?:string;label?:string};
      if(!response.ok)throw new Error(data.error??"Your profile could not be saved.");
      setLabel(data.label??"");setSaved(true);onSaved?.(data.label??"");
    }catch(cause){setError(cause instanceof Error?cause.message:"Your profile could not be saved.")}
    finally{setBusy(false)}
  }
  return <>
    <button className="profile-chip" onClick={()=>setOpen(true)} title="How you appear when you suggest something">
      <UserRound size={13}/>{label||"Set up how you appear"}
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="desk-dialog">
        <DialogHeader>
          <DialogTitle>How you appear</DialogTitle>
          <DialogDescription>Boards decide who may suggest changes; some ask for a public profile. Yours is used for nothing else.</DialogDescription>
        </DialogHeader>
        <form className="desk-form" onSubmit={event=>void save(event)}>
          <label>Handle<input required value={profile.handle} maxLength={24} onChange={event=>setProfile({...profile,handle:event.target.value})} placeholder="minseo"/><small>Letters, digits, hyphens and underscores. Board owners invite people by handle.</small></label>
          <label>Display name<input required value={profile.displayName} maxLength={60} onChange={event=>setProfile({...profile,displayName:event.target.value})}/></label>
          <label>About <span className="label-hint">optional</span><input value={profile.bio} maxLength={300} onChange={event=>setProfile({...profile,bio:event.target.value})}/></label>
          <label>Visibility<select value={profile.visibility} onChange={event=>setProfile({...profile,visibility:event.target.value})}>
            {choices.map(([value,text])=><option key={value} value={value}>{text}</option>)}
          </select></label>
          {error&&<p className="form-error" role="alert">{error}</p>}
          {saved&&<p className="small-note">Saved. Suggestions now travel as {label}.</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy?"Saving…":"Save"}</button>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
