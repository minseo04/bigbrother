import {create} from "zustand";
export type Board={id:string;name:string;pattern:string;patternColor:string;surface:string;gap:number;sort:number};
type BoardState={boards:Board[];activeId:string;setBoards:(boards:Board[])=>void;setActive:(id:string)=>void};
// Kept out of the graph store on purpose: that one is wrapped in zundo, and switching
// board is navigation rather than an edit — it has no place in the undo stack.
export const useBoardStore=create<BoardState>(set=>({
  boards:[],
  activeId:"",
  setBoards:boards=>set(state=>({boards,activeId:boards.some(board=>board.id===state.activeId)?state.activeId:boards[0]?.id??""})),
  setActive:id=>set({activeId:id}),
}));
export const activeBoard=(state:BoardState)=>state.boards.find(board=>board.id===state.activeId)??null;
