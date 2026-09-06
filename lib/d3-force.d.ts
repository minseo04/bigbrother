declare module "d3-force" {
  export interface SimulationNodeDatum {index?:number;x?:number;y?:number;vx?:number;vy?:number;fx?:number|null;fy?:number|null}
  export interface Simulation<N extends SimulationNodeDatum> {force(name:string,force:unknown):Simulation<N>;stop():Simulation<N>;tick(iterations?:number):Simulation<N>}
  export interface ForceLink<N extends SimulationNodeDatum,L> {id(accessor:(node:N)=>string):ForceLink<N,L>;distance(distance:number):ForceLink<N,L>}
  export interface ForceManyBody<N extends SimulationNodeDatum> {strength(strength:number):ForceManyBody<N>}
  export function forceSimulation<N extends SimulationNodeDatum>(nodes:N[]):Simulation<N>;
  export function forceLink<N extends SimulationNodeDatum,L>(links:L[]):ForceLink<N,L>;
  export function forceManyBody<N extends SimulationNodeDatum>():ForceManyBody<N>;
  export function forceCenter(x?:number,y?:number):unknown;
  export function forceCollide(radius:number):unknown;
}
