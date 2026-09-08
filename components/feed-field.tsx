"use client";
import {useState} from "react";
import {Rss} from "lucide-react";
import {entityFeed} from "@/lib/feeds";
import type {Entity} from "@/lib/intelligence";
// Rendered with a key of the saved feed URL, so a save remounts this and the draft
// resets from the prop. No effect is needed to keep the two in step.
export function FeedField({entity,onSave}:{entity:Entity;onSave:(entity:Entity,feedUrl:string)=>Promise<void>}){
  const [value,setValue]=useState(entity.feedUrl??""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const custom=Boolean(entity.feedUrl),derived=entityFeed({...entity,feedUrl:""}),dirty=value.trim()!==(entity.feedUrl??"");
  async function submit(event:{preventDefault():void}){
    event.preventDefault();setError("");setBusy(true);
    try{await onSave(entity,value.trim())}catch(cause){setError(cause instanceof Error?cause.message:"The feed could not be saved.")}
    finally{setBusy(false)}
  }
  return <section className="inspector-feed">
    <h3>Source feed</h3>
    <p className="muted">{custom?"Reading this publisher directly.":"No publisher feed set, so this entity is collected from a news search."}</p>
    {!custom&&<a className="source-link" href={derived} target="_blank" rel="noreferrer"><Rss size={13}/> View the search feed in use</a>}
    <form onSubmit={event=>void submit(event)} className="feed-form">
      <label>Feed URL<input type="url" value={value} onChange={event=>setValue(event.target.value)} placeholder="https://example.com/rss.xml"/></label>
      <div className="feed-actions">
        <button className="secondary-button" type="submit" disabled={busy||!dirty}>{busy?"Saving…":"Save feed"}</button>
        {custom&&<button type="button" className="text-button" disabled={busy} onClick={()=>{setValue("");void onSave(entity,"")}}>Use news search</button>}
      </div>
      {error&&<p className="form-error" role="alert">{error}</p>}
    </form>
    <p className="small-note">Must return RSS. A page that returns HTML is rejected when the feed is read, and the entity keeps whatever it collected before.</p>
  </section>;
}
