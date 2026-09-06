import {create} from "zustand";
import {temporal} from "zundo";
import type {GraphLayout} from "./graph-layout";
type DraftEdge={id:string;source:string;target:string};
type GraphState={positions:GraphLayout;draftEdges:DraftEdge[];replacePositions:(positions:GraphLayout)=>void;moveNode:(id:string,position:[number,number])=>void;addDraftEdge:(edge:DraftEdge)=>void;removeDraftEdge:(id:string)=>void;clearDraftEdges:()=>void};
export const useGraphStore=create<GraphState>()(temporal(set=>({positions:{},draftEdges:[],replacePositions:positions=>set({positions}),moveNode:(id,position)=>set(state=>({positions:{...state.positions,[id]:position}})),addDraftEdge:edge=>set(state=>({draftEdges:[...state.draftEdges,edge]})),removeDraftEdge:id=>set(state=>({draftEdges:state.draftEdges.filter(edge=>edge.id!==id)})),clearDraftEdges:()=>set({draftEdges:[]})})));
