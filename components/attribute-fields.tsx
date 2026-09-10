"use client";
import {useState} from "react";
import {Plus,Trash2,ExternalLink} from "lucide-react";
import type {Attribute} from "@/lib/dataframe";
import type {Entity} from "@/lib/intelligence";
type Props={entity:Entity;attributes:Attribute[];suggestions:string[];onSet:(entity:Entity,key:string,value:string,sourceUrl:string)=>Promise<void>;onDelete:(entity:Entity,key:string)=>Promise<void>};
function host(url:string){try{return new URL(url).hostname.replace(/^www\./,"")}catch{return ""}}
// Every attribute is a column in the table view, so what is typed here decides what
// can be grouped, sorted and downloaded later. The source field keeps a value
// traceable the way a connection's evidence is.
export function AttributeFields({entity,attributes,suggestions,onSet,onDelete}:Props){
  const [key,setKey]=useState(""),[value,setValue]=useState(""),[sourceUrl,setSourceUrl]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function add(event:{preventDefault():void}){
    event.preventDefault();setError("");setBusy(true);
    try{await onSet(entity,key.trim(),value.trim(),sourceUrl.trim());setKey("");setValue("");setSourceUrl("")}
    catch(cause){setError(cause instanceof Error?cause.message:"The attribute could not be saved.")}
    finally{setBusy(false)}
  }
  async function edit(attribute:Attribute,next:string){
    if(next.trim()===attribute.value||!next.trim())return;
    setError("");
    try{await onSet(entity,attribute.key,next.trim(),attribute.sourceUrl??"")}
    catch(cause){setError(cause instanceof Error?cause.message:"The attribute could not be saved.")}
  }
  return <section className="inspector-entity-fields attribute-fields">
    <h3>Attributes</h3>
    {attributes.length>0&&<ul className="attribute-list">
      {attributes.map(attribute=><li key={attribute.key}>
        <span className="attribute-key">{attribute.key}</span>
        <input defaultValue={attribute.value} maxLength={200} aria-label={attribute.key+" value"} onBlur={event=>void edit(attribute,event.target.value)}/>
        {attribute.sourceUrl?<a href={attribute.sourceUrl} target="_blank" rel="noopener noreferrer" title={attribute.sourceUrl}><ExternalLink size={12}/>{host(attribute.sourceUrl)}</a>:<span className="attribute-nosource">no source</span>}
        {attribute.contributor&&<span className="attribute-origin" title={"Accepted from "+attribute.contributor}>contributed</span>}
        <button type="button" className="attribute-remove" aria-label={"Remove "+attribute.key} onClick={()=>void onDelete(entity,attribute.key)}><Trash2 size={13}/></button>
      </li>)}
    </ul>}
    <form className="attribute-add" onSubmit={event=>void add(event)}>
      <input list="attribute-suggestions" value={key} maxLength={40} onChange={event=>setKey(event.target.value)} placeholder="Attribute, e.g. Investor" aria-label="Attribute name"/>
      <input value={value} maxLength={200} onChange={event=>setValue(event.target.value)} placeholder="Value" aria-label="Attribute value"/>
      <input type="url" value={sourceUrl} onChange={event=>setSourceUrl(event.target.value)} placeholder="Source URL (optional)" aria-label="Attribute source URL"/>
      <datalist id="attribute-suggestions">{suggestions.map(name=><option key={name} value={name}>{name}</option>)}</datalist>
      <button className="secondary-button" type="submit" disabled={busy||!key.trim()||!value.trim()}><Plus size={14}/>{busy?"Saving…":"Add attribute"}</button>
    </form>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <p className="small-note">Attributes become columns in the table view and options in the map&apos;s group-by picker. Saving a name that already exists replaces its value.</p>
  </section>;
}
