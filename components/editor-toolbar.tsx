"use client";
import {type RefObject} from "react";
import {Search} from "lucide-react";
import {useWorkspaceStore,type GraphMode} from "@/lib/workspace-store";
type Props={query:string;onQuery:(value:string)=>void;searchRef:RefObject<HTMLInputElement|null>};
const tools:[[GraphMode,string,string],[GraphMode,string,string],[GraphMode,string,string],[GraphMode,string,string]]=[["select","V","Select"],["pan","H","Pan"],["connect","C","Connect"],["new","N","New entity"]];
export function EditorToolbar({query,onQuery,searchRef}:Props){const mode=useWorkspaceStore(state=>state.mode),setMode=useWorkspaceStore(state=>state.setMode);return <><div className="shell-tools" aria-label="Graph tools">{tools.map(([tool,key,label])=><button key={tool} className={mode===tool?"active":""} onClick={()=>setMode(tool)} aria-label={label+" tool"} title={label+" ("+key+")"}><kbd>{key}</kbd><span>{label}</span></button>)}</div><label className="shell-search"><Search size={15}/><input ref={searchRef} value={query} onChange={event=>onQuery(event.target.value)} placeholder="Search entities" aria-label="Search entities"/><kbd>⌘K</kbd></label></>}