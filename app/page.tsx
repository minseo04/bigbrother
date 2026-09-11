"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {Check,Plus} from "lucide-react";
import {BottomDock} from "@/components/bottom-dock";
import {EditorToolbar} from "@/components/editor-toolbar";
import {GraphEditor,type GroupSelection} from "@/components/graph-editor";
import {Inspector} from "@/components/inspector";
import {Outliner} from "@/components/outliner";
import {BoardBar} from "@/components/board-bar";
import {MarketDashboard} from "@/components/market-dashboard";
import {DataTable} from "@/components/data-table";
import {SignIn} from "@/components/sign-in";
import {WorkspaceShell} from "@/components/workspace-shell";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "@/components/ui/dialog";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {useGraphStore} from "@/lib/graph-store";
import {initialConnections,initialEntities,initialSources,kinds,type Briefing,type Connection,type Entity,type EntityKind} from "@/lib/intelligence";
import {activeBoard,useBoardStore,type Board} from "@/lib/board-store";
import {useGraphStore as useGraphPositions} from "@/lib/graph-store";
import {useWorkspaceStore} from "@/lib/workspace-store";
import {buildTable,cellText,type Attribute} from "@/lib/dataframe";

async function api(path:string,body?:unknown){const response=await fetch(path,{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});const data=await response.json() as {error?:string;[key:string]:unknown};if(!response.ok){const failure=new Error(data.error??"Unable to complete the request.") as Error&{status?:number};failure.status=response.status;throw failure}return data;}

export default function Home(){
  const[entities,setEntities]=useState(initialEntities),[connections,setConnections]=useState(initialConnections),[briefing,setBriefing]=useState<Briefing|null>(null),[query,setQuery]=useState(""),[view,setView]=useState<"market"|"network"|"table">("network"),[selected,setSelected]=useState<Entity|null>(null),[edge,setEdge]=useState<Connection|null>(null),[addOpen,setAddOpen]=useState(false),[linkOpen,setLinkOpen]=useState(false),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[authRequired,setAuthRequired]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[newNodePosition,setNewNodePosition]=useState<[number,number]|null>(null),[group,setGroup]=useState<GroupSelection|null>(null),[attributes,setAttributes]=useState<Attribute[]>([]),[noteCounts,setNoteCounts]=useState<Record<string,number>>({});
  const[name,setName]=useState(""),[kind,setKind]=useState<EntityKind>("Person"),[kindNew,setKindNew]=useState(false),[sourceUrl,setSourceUrl]=useState(""),[feedUrl,setFeedUrl]=useState(""),[imageUrl,setImageUrl]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState(""),[label,setLabel]=useState(""),[evidence,setEvidence]=useState(""),[relationStatus,setRelationStatus]=useState("Documented"),[date,setDate]=useState(""),[formError,setFormError]=useState(""),[articleScope,setArticleScope]=useState("Following"),[dockTab,setDockTab]=useState<"Briefing"|"Sources"|"Evidence">("Briefing");
  const searchRef=useRef<HTMLInputElement>(null);
  const kindOptions=[...new Set([...kinds,...entities.map(entity=>entity.kind)])].sort((a,b)=>a.localeCompare(b));
  async function load(){try{const data=await api("/api/workspace") as {entities:Entity[];connections:Connection[]};setEntities(data.entities);setConnections(data.connections);setLoaded(true);setError("");}catch(cause){if((cause as {status?:number}).status===401){setAuthRequired(true);return}setError("Your workspace could not be loaded. "+(cause as Error).message)}}
  async function refresh(){setBusy(true);try{setBriefing(await api("/api/briefing") as unknown as Briefing);setError("");}catch(cause){if((cause as {status?:number}).status===401){setAuthRequired(true);return}setError("The news refresh did not finish. "+(cause as Error).message)}finally{setBusy(false)}}
  const board=useBoardStore(activeBoard);
  const positions=useGraphPositions(state=>state.positions);
  const boardIds=new Set(Object.keys(positions));
  const table=useMemo(()=>buildTable(entities,connections,noteCounts,attributes),[entities,connections,noteCounts,attributes]);
  const tableRows=useMemo(()=>{const needle=query.trim().toLowerCase();if(!needle)return table;return{columns:table.columns,rows:table.rows.filter(row=>table.columns.some(column=>cellText(row.cells[column.key]).toLowerCase().includes(needle)))}},[table,query]);
  const attributeNames=useMemo(()=>table.columns.filter(column=>column.source!=="core").map(column=>column.label),[table.columns]);
  async function loadAttributes(){const data=await api("/api/workspace?attributes=1") as {attributes:Attribute[];noteCounts?:Record<string,number>};setAttributes(data.attributes);setNoteCounts(data.noteCounts??{})}
  async function saveAttribute(entity:Entity,key:string,value:string,sourceUrl:string){await api("/api/workspace",{action:"attribute-set",entityId:entity.id,key,value,sourceUrl});await loadAttributes();setNotice("Attribute saved. It is now a column in the table view.")}
  async function removeAttribute(entity:Entity,key:string){await api("/api/workspace",{action:"attribute-delete",entityId:entity.id,key});await loadAttributes();setNotice("Attribute removed.")}
  async function toggleBoardMember(entity:Entity,onBoard:boolean){
    if(!board)return;
    try{
      const current=useGraphPositions.getState().positions;
      const slot=Object.keys(current).length;
      const at:[number,number]=[(slot%5)*220-440,Math.floor(slot/5)*180-180];
      await api("/api/workspace",{action:onBoard?"board-remove":"board-place",id:board.id,entityId:entity.id,position:at});
      const positions={...current};
      if(onBoard)delete positions[entity.id];else positions[entity.id]=at;
      useGraphPositions.getState().replacePositions(positions);
      setNotice(onBoard?entity.name+" removed from "+board.name+".":entity.name+" added to "+board.name+".");
    }catch(cause){setError((cause as Error).message)}
  }
  async function loadBoards(){const data=await api("/api/workspace?boards=1") as {boards:Board[]};useBoardStore.getState().setBoards(data.boards)}
  async function createBoard(name:string){await api("/api/workspace",{action:"board-create",name});await loadBoards();setNotice("Board created. Drop entities on it from the outliner.")}
  async function updateBoard(id:string,change:Partial<Board>){await api("/api/workspace",{action:"board-update",id,...change});await loadBoards()}
  async function deleteBoard(id:string){await api("/api/workspace",{action:"board-delete",id});await loadBoards();setNotice("Board deleted. The entities themselves are untouched.")}
  async function importTable(result:{boardId:string;name:string;created:number;reused:number;placed:number;connections:number;truncated:number}){
    await load();
    await loadBoards();
    await loadAttributes().catch(()=>{});
    useBoardStore.getState().setActive(result.boardId);
    useWorkspaceStore.getState().requestFitView();
    setView("network");
    setError("");
    const parts=[result.placed+" nodes on "+result.name];
    if(result.connections)parts.push(result.connections+" connections");
    if(result.truncated)parts.push(result.truncated+" extra rows skipped");
    setNotice("Imported "+parts.join(". ")+".");
  }
  useEffect(()=>{void load();void refresh();void loadBoards().catch(()=>{});void loadAttributes().catch(()=>{});if("serviceWorker" in navigator)void navigator.serviceWorker.register("/sw.js").catch(()=>{});const keyboard=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();searchRef.current?.focus()}};window.addEventListener("keydown",keyboard);return()=>window.removeEventListener("keydown",keyboard)},[]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(""),5000);return()=>clearTimeout(timer)},[notice]);
  function inspectEntity(entity:Entity){useWorkspaceStore.getState().selectEntity(entity.id);setSelected(entity);setEdge(null);setGroup(null)}
  function inspectConnection(connection:Connection){useWorkspaceStore.getState().selectConnection(connection.id);setEdge(connection);setSelected(null);setGroup(null)}
  async function follow(entity:Entity){try{await api("/api/workspace",{action:"follow",id:entity.id,followed:!entity.followed});setEntities(all=>all.map(item=>item.id===entity.id?{...item,followed:!entity.followed}:item));setSelected(current=>current?.id===entity.id?{...current,followed:!entity.followed}:current)}catch(cause){setError((cause as Error).message)}}
  async function saveEntity(entity:Entity,change:{kind?:string;image?:string}){await api("/api/workspace",{action:"entity",id:entity.id,...change});await load();setSelected(current=>current?.id===entity.id?{...current,...change}:current);setNotice("Entity updated.")}
  async function saveFeed(entity:Entity,feedUrl:string){await api("/api/workspace",{action:"feed",id:entity.id,feedUrl});await load();setSelected(current=>current?.id===entity.id?{...current,feedUrl}:current);setNotice(feedUrl?"Feed saved. It is read on the next collection pass.":"Feed cleared. This entity falls back to news search.")}
  function openEntity(position:[number,number]){setNewNodePosition(position);setSourceUrl("");setFeedUrl("");setImageUrl("");setKindNew(false);setKind("Person");setFormError("");setAddOpen(true)}
  function openConnection(source:string,target=""){setFrom(source);setTo(target);setSourceUrl("");setFormError("");setLinkOpen(true)}
  async function addEntity(event:{preventDefault():void}){event.preventDefault();setFormError("");setBusy(true);try{const added=await api("/api/workspace",{action:"add",name,kind,source:sourceUrl,feedUrl,image:imageUrl}) as {id:string};if(newNodePosition){const positions={...useGraphStore.getState().positions,[added.id]:newNodePosition};useGraphStore.getState().replacePositions(positions);await api("/api/workspace",{action:"layout",boardId:board?.id,positions})}await load();setAddOpen(false);setNewNodePosition(null);setName("");setSourceUrl("");setFeedUrl("");setImageUrl("");setKindNew(false);setNotice("Entity added to your watchlist.")}catch(cause){setFormError((cause as Error).message)}finally{setBusy(false)}}
  async function addConnection(event:{preventDefault():void}){event.preventDefault();setFormError("");setBusy(true);try{await api("/api/workspace",{action:"connect",from,to,label,evidence,url:sourceUrl,date,status:relationStatus});await load();setLinkOpen(false);setSourceUrl("");setLabel("");setEvidence("");setNotice("Connection saved with its evidence.")}catch(cause){setFormError((cause as Error).message)}finally{setBusy(false)}}
  const inspector=<Inspector key={selected?.id??edge?.id??group?.label??"workspace"} entities={entities} connections={connections} briefing={briefing} selected={selected} edge={edge} loaded={loaded} onFollow={follow} onEdge={inspectConnection} onEntity={inspectEntity} onFeed={saveFeed} onEntitySave={saveEntity} group={group} attributes={attributes} attributeNames={attributeNames} onAttributeSet={saveAttribute} onAttributeDelete={removeAttribute}/>;
  const dock=<BottomDock tab={dockTab} onTab={setDockTab} articles={briefing?.articles??[]} sources={briefing?.sources??initialSources} connections={connections} entities={entities} scope={articleScope} onScope={setArticleScope} busy={busy} onRefresh={refresh} onArticle={ids=>{useWorkspaceStore.getState().selectEntities(ids);setSelected(entities.find(entity=>entity.id===ids[0])??null);setEdge(null)}} onConnection={inspectConnection}/>;
  if(authRequired)return <SignIn/>;
  return <WorkspaceShell toolbar={<EditorToolbar query={query} onQuery={setQuery} searchRef={searchRef} view={view} onView={setView} loaded={loaded} onImported={importTable} onImportError={setError}/>} outliner={<Outliner entities={entities} query={query} loaded={loaded} onSelect={inspectEntity} onFollow={follow} boardIds={boardIds} boardName={board?.name??"this board"} onBoardToggle={toggleBoardMember}/>} inspector={inspector} bottom={dock}>
    <main className={view==="market"?"market-workspace":view==="table"?"table-workspace":"graph-workspace"}>{error&&<div className="shell-message error-message" role="alert">{error}<button onClick={()=>{void load();void refresh()}}>Retry</button></div>}{notice&&<div className="shell-message notice-message" role="status"><Check size={16}/>{notice}</div>}{view==="market"?<MarketDashboard entities={entities} query={query} onSelect={inspectEntity}/>:view==="table"?<DataTable table={tableRows} connections={connections} positions={positions} board={{id:board?.id??"",name:board?.name??"Workspace"}} selectedId={selected?.id} onSelect={inspectEntity} onImported={importTable} onImportError={setError}/>:<><BoardBar onCreate={createBoard} onUpdate={updateBoard} onDelete={deleteBoard} names={Object.fromEntries(entities.map(entity=>[entity.id,entity.name]))} onProposalAccepted={()=>{void load();void loadAttributes()}}/><GraphEditor entities={entities} connections={connections} table={table} onGroup={next=>{setGroup(next);if(next){setSelected(null);setEdge(null)}}} onEntity={inspectEntity} onConnection={inspectConnection} onToggleFollow={follow} onConnectPair={openConnection} onConnectFrom={openConnection} onNewEntity={openEntity} full/></>}</main>
    <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="desk-dialog"><DialogHeader><DialogTitle>Follow an entity</DialogTitle><DialogDescription>Add a public person, organization, or technology to your watchlist.</DialogDescription></DialogHeader><form onSubmit={event=>void addEntity(event)} className="desk-form"><label>Name<input required maxLength={100} value={name} onChange={event=>setName(event.target.value)} placeholder="e.g. SpaceX"/></label><label>Category<Select value={kindNew?"__new":kind} onValueChange={value=>{if(!value)return;if(value==="__new"){setKindNew(true);setKind("")}else{setKindNew(false);setKind(value)}}}><SelectTrigger className="wide-select"><SelectValue placeholder="Choose a category">{kindNew?"New category…":kind}</SelectValue></SelectTrigger><SelectContent>{kindOptions.map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}<SelectItem value="__new">New category…</SelectItem></SelectContent></Select>{kindNew&&<input required maxLength={40} value={kind} onChange={event=>setKind(event.target.value)} placeholder="Name your category"/>}<small>Entities sharing a category share a colour.</small></label><label>Public source URL<input type="url" required value={sourceUrl} onChange={event=>setSourceUrl(event.target.value)} placeholder="https://…"/></label><label>Source feed <span className="label-hint">optional</span><input type="url" value={feedUrl} onChange={event=>setFeedUrl(event.target.value)} placeholder="https://example.com/rss.xml"/><small>Leave empty to collect this entity from a news search instead.</small></label><label>Image <span className="label-hint">optional</span><input type="url" value={imageUrl} onChange={event=>setImageUrl(event.target.value)} placeholder="https://example.com/portrait.jpg"/><small>Shown on the node in place of the initials.</small></label>{formError&&<p role="alert" className="form-error">{formError}</p>}<button className="primary-button" disabled={busy||!loaded} type="submit"><Plus size={16}/>{busy?"Saving…":"Add to watchlist"}</button></form></DialogContent></Dialog>
    <Dialog open={linkOpen} onOpenChange={setLinkOpen}><DialogContent className="desk-dialog"><DialogHeader><DialogTitle>Add a connection</DialogTitle><DialogDescription>Record a relationship and the evidence behind it.</DialogDescription></DialogHeader><form onSubmit={event=>void addConnection(event)} className="desk-form"><div className="form-columns">{[["From",from,setFrom],["To",to,setTo]].map(([title,value,setter])=><label key={title as string}>{title as string}<Select value={value as string} onValueChange={next=>(setter as (value:string)=>void)(next??"")}><SelectTrigger className="wide-select"><SelectValue placeholder="Choose entity">{entities.find(entity=>entity.id===(value as string))?.name}</SelectValue></SelectTrigger><SelectContent>{entities.map(entity=><SelectItem key={entity.id} value={entity.id}>{entity.name}</SelectItem>)}</SelectContent></Select></label>)}</div><label>Relationship<input required maxLength={100} value={label} onChange={event=>setLabel(event.target.value)} placeholder="e.g. co-founded"/></label><label>Evidence<textarea required maxLength={1200} value={evidence} onChange={event=>setEvidence(event.target.value)} placeholder="What does the source establish?"/></label><label>Source URL<input type="url" required value={sourceUrl} onChange={event=>setSourceUrl(event.target.value)}/></label><div className="form-columns"><label>Source date<input type="date" required value={date} onChange={event=>setDate(event.target.value)}/></label><label>Evidence type<Select value={relationStatus} onValueChange={value=>setRelationStatus(value??"Documented")}><SelectTrigger className="wide-select"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Documented">Documented</SelectItem><SelectItem value="Hypothesis">Hypothesis</SelectItem></SelectContent></Select></label></div>{formError&&<p className="form-error" role="alert">{formError}</p>}<button className="primary-button" type="submit" disabled={busy||!loaded}>{busy?"Saving…":"Save connection"}</button></form></DialogContent></Dialog>
  </WorkspaceShell>
}
