import {forceCenter,forceCollide,forceLink,forceManyBody,forceSimulation,type SimulationNodeDatum} from "d3-force";
import type {Connection,Entity} from "./intelligence";
export type GraphLayout=Record<string,[number,number]>;
type LayoutNode=SimulationNodeDatum&{id:string};
type LayoutLink={source:string|LayoutNode;target:string|LayoutNode};
export function seedLayout(entities:Entity[],connections:Connection[]):GraphLayout{const nodes:LayoutNode[]=entities.map(entity=>({id:entity.id}));const ids=new Set(nodes.map(node=>node.id));const links:LayoutLink[]=connections.filter(connection=>ids.has(connection.from)&&ids.has(connection.to)).map(connection=>({source:connection.from,target:connection.to}));forceSimulation(nodes).force("link",forceLink<LayoutNode,LayoutLink>(links).id(node=>node.id).distance(180)).force("charge",forceManyBody<LayoutNode>().strength(-800)).force("center",forceCenter(0,0)).force("collide",forceCollide(90)).stop().tick(400);return Object.fromEntries(nodes.map(node=>[node.id,[Math.round(node.x??0),Math.round(node.y??0)]]));}
