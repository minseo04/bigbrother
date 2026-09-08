"use client";
import {useState} from "react";
import {Check,Plus,Settings2,Trash2} from "lucide-react";
import {Popover,PopoverContent,PopoverTrigger} from "@/components/ui/popover";
import {activeBoard,useBoardStore,type Board} from "@/lib/board-store";
const patterns:[string,string][]=[["dots","Dots"],["lines","Lines"],["cross","Cross"],["none","Plain"]];
type Props={onCreate:(name:string)=>Promise<void>;onUpdate:(id:string,change:Partial<Board>)=>Promise<void>;onDelete:(id:string)=>Promise<void>};
export function BoardBar({onCreate,onUpdate,onDelete}:Props){
  const boards=useBoardStore(state=>state.boards),setActive=useBoardStore(state=>state.setActive),active=useBoardStore(activeBoard);
  const [adding,setAdding]=useState(false),[name,setName]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function create(event:{preventDefault():void}){
    event.preventDefault();setError("");setBusy(true);
    try{await onCreate(name.trim());setName("");setAdding(false)}
    catch(cause){setError(cause instanceof Error?cause.message:"The board could not be created.")}
    finally{setBusy(false)}
  }
  return <div className="board-bar">
    <div className="board-tabs" role="tablist" aria-label="Boards">
      {boards.map(board=><button key={board.id} role="tab" aria-selected={board.id===active?.id} className={"board-tab"+(board.id===active?.id?" is-active":"")} onClick={()=>setActive(board.id)}>{board.name}</button>)}
    </div>
    {adding
      ? <form className="board-new" onSubmit={event=>void create(event)}>
          <input value={name} onChange={event=>setName(event.target.value)} maxLength={60} placeholder="Board name" aria-label="New board name"/>
          <button type="submit" className="secondary-button" disabled={busy||!name.trim()}>{busy?"Adding…":"Add"}</button>
          <button type="button" className="text-button" onClick={()=>{setAdding(false);setName("");setError("")}}>Cancel</button>
        </form>
      : <button className="board-add" onClick={()=>setAdding(true)} aria-label="New board"><Plus size={14}/> New board</button>}
    {error&&<span className="form-error" role="alert">{error}</span>}
    {active&&<Popover>
      <PopoverTrigger className="board-settings" aria-label="Board background"><Settings2 size={14}/> Background</PopoverTrigger>
      <PopoverContent className="board-popover" align="end" sideOffset={8}>
        <label>Board name<input defaultValue={active.name} maxLength={60} onBlur={event=>{const value=event.target.value.trim();if(value&&value!==active.name)void onUpdate(active.id,{name:value})}}/></label>
        <span className="board-field-label">Pattern</span>
        <div className="board-patterns">
          {patterns.map(([value,label])=><button key={value} className={value===active.pattern?"is-active":""} onClick={()=>void onUpdate(active.id,{pattern:value})}>{value===active.pattern&&<Check size={12}/>}{label}</button>)}
        </div>
        <div className="board-colors">
          <label>Surface<input type="color" value={active.surface} onChange={event=>void onUpdate(active.id,{surface:event.target.value})}/></label>
          <label>Pattern colour<input type="color" value={active.patternColor} onChange={event=>void onUpdate(active.id,{patternColor:event.target.value})}/></label>
        </div>
        <label>Background image<input type="url" defaultValue={active.image} placeholder="https://example.com/photo.jpg" onBlur={event=>{const value=event.target.value.trim();if(value!==active.image)void onUpdate(active.id,{image:value})}}/></label>{active.image&&<div className="board-fits">{([["cover","Fill"],["contain","Fit"],["tile","Tile"]] as [string,string][]).map(([value,text])=><button key={value} className={value===active.imageFit?"is-active":""} onClick={()=>void onUpdate(active.id,{imageFit:value})}>{text}</button>)}</div>}<label>Node size <span className="board-gap-value">{active.nodeScale}%</span><input type="range" min={60} max={200} step={5} value={active.nodeScale} onChange={event=>void onUpdate(active.id,{nodeScale:Number(event.target.value)})}/></label><label>Spacing <span className="board-gap-value">{active.gap}px</span><input type="range" min={8} max={80} step={2} value={active.gap} onChange={event=>void onUpdate(active.id,{gap:Number(event.target.value)})}/></label>
        {boards.length>1&&<button className="board-delete text-button" onClick={()=>void onDelete(active.id)}><Trash2 size={13}/> Delete this board</button>}
      </PopoverContent>
    </Popover>}
  </div>;
}
