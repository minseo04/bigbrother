"use client";
// The owner's side of the suggestion layer: four boxes, one per kind, and two
// decisions. Accepting is the only way anything here reaches the workspace.
import {useCallback,useEffect,useState} from "react";
import {Check,Inbox,ExternalLink,X} from "lucide-react";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "@/components/ui/dialog";
type Contribution={id:string;boardId:string;kind:string;targetId:string;payload:string;evidenceUrl:string;message:string;contributorLabel:string;created:string};
type Props={boardId:string;boardName:string;names:Record<string,string>;onApplied:()=>void};
const boxes:[string,string][]=[["attribute","Attributes"],["connection","Connections"],["entity","New entities"],["source","Sources"]];
function host(url:string){try{return new URL(url).hostname.replace(/^www\./,"")}catch{return url}}
function summary(item:Contribution,names:Record<string,string>){
  let payload:Record<string,unknown>={};
  try{payload=JSON.parse(item.payload) as Record<string,unknown>}catch{}
  const value=(key:string)=>typeof payload[key]==="string"?payload[key] as string:"";
  const name=(id:string)=>names[id]??id;
  if(item.kind==="attribute")return {title:name(value("entityId")||item.targetId),detail:value("key")+" — "+value("value")};
  if(item.kind==="connection")return {title:name(value("from"))+" → "+name(value("to")),detail:value("label")+" · "+value("date")+" · "+value("evidence")};
  if(item.kind==="entity")return {title:value("name"),detail:(value("kind")||"Company")+(value("description")?" · "+value("description"):"")};
  return {title:name(value("connectionId")||item.targetId),detail:value("note")||"Another account of this connection"};
}
export function ProposalsInbox({boardId,boardName,names,onApplied}:Props){
  const[open,setOpen]=useState(false),[items,setItems]=useState<Contribution[]>([]),[box,setBox]=useState("attribute"),[busy,setBusy]=useState(""),[error,setError]=useState("");
  const load=useCallback(async()=>{
    try{
      const response=await fetch("/api/contributions?board="+encodeURIComponent(boardId));
      const data=await response.json() as {contributions?:Contribution[];error?:string};
      if(!response.ok)throw new Error(data.error??"The inbox could not be read.");
      setItems(data.contributions??[]);setError("");
    }catch(cause){setError(cause instanceof Error?cause.message:"The inbox could not be read.")}
  },[boardId]);
  useEffect(()=>{
    if(!boardId)return;
    const timer=setTimeout(()=>void load(),0);
    return()=>clearTimeout(timer);
  },[boardId,load]);
  async function decide(item:Contribution,decision:"accept"|"decline"){
    setBusy(item.id);setError("");
    try{
      const response=await fetch("/api/contributions",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,boardId,decision})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error??"The decision could not be saved.");
      setItems(current=>current.filter(entry=>entry.id!==item.id));
      if(decision==="accept")onApplied();
    }catch(cause){setError(cause instanceof Error?cause.message:"The decision could not be saved.")}
    finally{setBusy("")}
  }
  const shown=items.filter(item=>item.kind===box);
  return <>
    <button className="board-inbox" onClick={()=>{setOpen(true);void load()}}>
      <Inbox size={14}/> Suggestions{items.length>0&&<b>{items.length}</b>}
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="desk-dialog inbox-dialog">
        <DialogHeader>
          <DialogTitle>Suggestions for “{boardName}”</DialogTitle>
          <DialogDescription>Readers of the shared board proposed these. Nothing is in your workspace until you accept it.</DialogDescription>
        </DialogHeader>
        <div className="inbox-tabs" role="tablist">
          {boxes.map(([value,label])=><button key={value} role="tab" aria-selected={box===value} className={box===value?"is-active":""} onClick={()=>setBox(value)}>
            {label}<b>{items.filter(item=>item.kind===value).length}</b>
          </button>)}
        </div>
        {error&&<p className="form-error" role="alert">{error}</p>}
        {!shown.length&&<p className="inbox-empty">Nothing waiting in this box.</p>}
        <ul className="inbox-list">
          {shown.map(item=>{const view=summary(item,names);return <li key={item.id}>
            <div>
              <strong>{view.title}</strong>
              <p>{view.detail}</p>
              {item.message&&<p className="inbox-message">“{item.message}”</p>}
              <span className="inbox-meta">
                {item.contributorLabel} · {item.created.slice(0,10)}
                {item.evidenceUrl&&<a href={item.evidenceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={12}/>{host(item.evidenceUrl)}</a>}
              </span>
            </div>
            <div className="inbox-actions">
              <button className="inbox-accept" disabled={busy===item.id} onClick={()=>void decide(item,"accept")}><Check size={14}/> Accept</button>
              <button className="inbox-decline" disabled={busy===item.id} onClick={()=>void decide(item,"decline")}><X size={14}/> Decline</button>
            </div>
          </li>})}
        </ul>
      </DialogContent>
    </Dialog>
  </>;
}
