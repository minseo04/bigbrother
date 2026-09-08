"use client";
import {useState} from "react";
import type {Entity} from "@/lib/intelligence";
// Keyed on the saved values by the Inspector, so a save remounts this and the drafts
// reset from the props without an effect keeping them in step.
export function EntityFields({entity,onSave}:{entity:Entity;onSave:(entity:Entity,change:{kind?:string;image?:string})=>Promise<void>}){
  const [kind,setKind]=useState(entity.kind),[image,setImage]=useState(entity.image??""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const change:{kind?:string;image?:string}={};
  if(kind.trim()&&kind.trim()!==entity.kind)change.kind=kind.trim();
  if(image.trim()!==(entity.image??""))change.image=image.trim();
  const dirty=Object.keys(change).length>0;
  async function submit(event:{preventDefault():void}){
    event.preventDefault();setError("");setBusy(true);
    try{await onSave(entity,change)}
    catch(cause){setError(cause instanceof Error?cause.message:"The entity could not be saved.")}
    finally{setBusy(false)}
  }
  return <section className="inspector-entity-fields">
    <h3>Category and image</h3>
    <form className="feed-form" onSubmit={event=>void submit(event)}>
      <label>Category<input value={kind} maxLength={40} onChange={event=>setKind(event.target.value)} placeholder="Person, Company, or your own"/></label>
      <label>Image URL<input type="url" value={image} onChange={event=>setImage(event.target.value)} placeholder="https://example.com/portrait.jpg"/></label>
      {/* eslint-disable-next-line next/no-img-element */}
      {image.trim()&&<img className="entity-preview-image" src={image.trim()} alt="" onError={event=>{event.currentTarget.style.display="none"}}/>}
      <div className="feed-actions">
        <button className="secondary-button" type="submit" disabled={busy||!dirty}>{busy?"Saving…":"Save"}</button>
        {entity.image&&<button type="button" className="text-button" disabled={busy} onClick={()=>{setImage("");void onSave(entity,{image:""})}}>Remove image</button>}
      </div>
      {error&&<p className="form-error" role="alert">{error}</p>}
    </form>
    <p className="small-note">Entities in the same category share a colour. Images are linked, not uploaded, so the source has to stay reachable.</p>
  </section>;
}
