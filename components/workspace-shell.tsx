"use client";
import {useEffect,useState,type ReactNode} from "react";
import {PanelLeft,PanelRight,PanelBottom} from "lucide-react";
import {ResizableHandle,ResizablePanel,ResizablePanelGroup,usePanelRef} from "@/components/ui/resizable";
type Layout=Record<string,number>;
type Props={children:ReactNode;toolbar:ReactNode;outliner:ReactNode;inspector:ReactNode;bottom:ReactNode};
function saved(key:string,fallback:Layout){try{const value=JSON.parse(localStorage.getItem(key)??"") as unknown;if(value&&typeof value==="object"&&!Array.isArray(value)&&Object.values(value).every(size=>typeof size==="number"))return value as Layout;}catch{}return fallback;}
function savedFlag(key:string){try{return localStorage.getItem(key)==="1"}catch{return false}}
function MountedShell({children,toolbar,outliner,inspector,bottom}:Props){
  const[horizontal]=useState(()=>saved("shell-horizontal",{outliner:16,viewport:59,inspector:25})),[vertical]=useState(()=>saved("shell-vertical",{workspace:96,dock:4}));
  const outlinerRef=usePanelRef(),inspectorRef=usePanelRef(),dockRef=usePanelRef();
  const[outlinerOff,setOutlinerOff]=useState(()=>savedFlag("shell-outliner-collapsed"));
  const[inspectorOff,setInspectorOff]=useState(()=>savedFlag("shell-inspector-collapsed"));
  const[dockOff,setDockOff]=useState(()=>savedFlag("shell-dock-collapsed"));
  // Restore the folded panels once, imperatively. The panels own their sizes, so this
  // asks them to collapse rather than trying to drive them from React state.
  useEffect(()=>{
    if(savedFlag("shell-outliner-collapsed"))outlinerRef.current?.collapse();
    if(savedFlag("shell-inspector-collapsed"))inspectorRef.current?.collapse();
    if(savedFlag("shell-dock-collapsed"))dockRef.current?.collapse();
  },[outlinerRef,inspectorRef,dockRef]);
  const fold=(off:boolean,set:(value:boolean)=>void,ref:ReturnType<typeof usePanelRef>,key:string)=>{
    const next=!off;
    set(next);
    try{localStorage.setItem(key,next?"1":"0")}catch{}
    if(next)ref.current?.collapse();else ref.current?.expand();
  };
  return <div className="editor-shell">
    <header className="shell-toolbar">
      {toolbar}
      <div className="shell-folds" role="toolbar" aria-label="Panels">
        <button className={outlinerOff?"":"is-open"} aria-pressed={!outlinerOff} onClick={()=>fold(outlinerOff,setOutlinerOff,outlinerRef,"shell-outliner-collapsed")} title="Outliner" aria-label={(outlinerOff?"Show":"Hide")+" the outliner"}><PanelLeft size={15}/></button>
        <button className={dockOff?"":"is-open"} aria-pressed={!dockOff} onClick={()=>fold(dockOff,setDockOff,dockRef,"shell-dock-collapsed")} title="Bottom dock" aria-label={(dockOff?"Show":"Hide")+" the bottom dock"}><PanelBottom size={15}/></button>
        <button className={inspectorOff?"":"is-open"} aria-pressed={!inspectorOff} onClick={()=>fold(inspectorOff,setInspectorOff,inspectorRef,"shell-inspector-collapsed")} title="Inspector" aria-label={(inspectorOff?"Show":"Hide")+" the inspector"}><PanelRight size={15}/></button>
      </div>
    </header>
    <ResizablePanelGroup orientation="vertical" defaultLayout={vertical} onLayoutChanged={layout=>{localStorage.setItem("shell-vertical",JSON.stringify(layout));const collapsed=dockRef.current?.isCollapsed()??false;setDockOff(collapsed);try{localStorage.setItem("shell-dock-collapsed",collapsed?"1":"0")}catch{}}}>
      <ResizablePanel id="workspace" minSize="400px">
        <ResizablePanelGroup orientation="horizontal" defaultLayout={horizontal} onLayoutChanged={layout=>{localStorage.setItem("shell-horizontal",JSON.stringify(layout));const left=outlinerRef.current?.isCollapsed()??false,right=inspectorRef.current?.isCollapsed()??false;setOutlinerOff(left);setInspectorOff(right);try{localStorage.setItem("shell-outliner-collapsed",left?"1":"0");localStorage.setItem("shell-inspector-collapsed",right?"1":"0")}catch{}}}>
          <ResizablePanel panelRef={outlinerRef} id="outliner" defaultSize="200px" collapsedSize="0px" minSize="160px" collapsible className="shell-panel shell-outliner">{outliner}</ResizablePanel>
          <ResizableHandle/>
          <ResizablePanel id="viewport" minSize="400px" className="shell-viewport">{children}</ResizablePanel>
          <ResizableHandle/>
          <ResizablePanel panelRef={inspectorRef} id="inspector" defaultSize="320px" collapsedSize="0px" minSize="260px" collapsible className="shell-panel shell-inspector">{inspector}</ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle/>
      <ResizablePanel panelRef={dockRef} id="dock" defaultSize="240px" minSize="100px" collapsedSize="36px" collapsible className="shell-panel shell-dock">{bottom}</ResizablePanel>
    </ResizablePanelGroup>
  </div>;
}
export function WorkspaceShell(props:Props){const[mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);return <><div className="desktop-required"><strong>Big Brother is a desktop workspace.</strong><span>Open it in a window at least 1100px wide.</span></div>{mounted?<MountedShell {...props}/>:<div className="editor-shell"/>}</>}
