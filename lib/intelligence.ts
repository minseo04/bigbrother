export type EntityKind = "Person" | "Company" | "Government" | "Technology";
export type Entity = { id: string; name: string; kind: EntityKind; initials: string; description: string; aliases: string[]; followed: boolean; source: string; color: string };
export type Connection = { id: string; from: string; to: string; label: string; evidence: string; url: string; date: string; status: "Documented" | "Hypothesis"; };
export type Article = { id: string; title: string; url: string; source: string; summary?: string; published: string; entities: string[]; };
export type Source = { id: string; name: string; url: string; feed: string; status?: string; count?: number; checked?: string };
export type Briefing = { date: string; articles: Omit<Article,"summary">[]; sources: Source[]; updated: string; };
export const kinds: EntityKind[] = ["Person", "Company", "Government", "Technology"];
const definitions: [string,string,EntityKind,string,string,string[]][] = [
["thiel","Peter Thiel","Person","PT","Investor and entrepreneur.",["Peter Thiel","Thiel"]],
["musk","Elon Musk","Person","EM","Entrepreneur.",["Elon Musk","Musk"]],
["trump","Donald Trump","Person","DT","US public official.",["Donald Trump","President Trump","Trump"]],
["altman","Sam Altman","Person","SA","Technology executive.",["Sam Altman","Altman"]],
["openai","OpenAI","Company","O","AI research and products.",["OpenAI","ChatGPT"]],
["palantir","Palantir","Company","P","Data analytics software.",["Palantir"]],
["anduril","Anduril","Company","A","Defense technology.",["Anduril"]],
["cia","CIA","Government","CIA","US Central Intelligence Agency.",["CIA","Central Intelligence Agency"]],
["fbi","FBI","Government","FBI","US Federal Bureau of Investigation.",["FBI","Federal Bureau of Investigation"]],
["congress","US Congress","Government","US","US legislature.",["Congress","congressional","Senate","House of Representatives"]],
["ccp","Chinese Communist Party","Government","CCP","Political party in China.",["Chinese Communist Party","Communist Party of China","CPC","CCP"]],
["anthropic","Anthropic","Company","An","AI research and products.",["Anthropic"]],
["claude","Claude","Technology","C","AI assistant.",["Claude"]],
["ai","Artificial intelligence","Technology","AI","AI research, systems, and applications.",["artificial intelligence"," AI ","machine learning"]],
["agents","AI agents","Technology","Ag","AI systems that perform multistep tasks.",["AI agent","agentic","agents"]],
];
export const initialEntities: Entity[] = definitions.map(([id,name,kind,initials,description,aliases])=>({id,name,kind,initials,description,aliases,followed:true,source:"",color:kind==="Person"?"#ed997b":kind==="Company"?"#86a8fc":kind==="Government"?"#c2acf0":"#78c7af"}));
export const initialConnections: Connection[] = [];
export const initialSources: Source[] = [];
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Short aliases ("AI", "CIA") must match as whole words. Aliases come from user input,
// so they are escaped — an unescaped name like "C++" would throw and break every feed.
export function entityMatches(text: string, entity: Entity) { const value = " "+text.toLowerCase()+" "; return entity.aliases.some(alias => { const a=alias.toLowerCase(),short=a.trim(); if(!short) return false; if(short.length<=3){ try { return new RegExp("(?<![\\p{L}\\p{N}])"+escapeRegExp(short)+"(?![\\p{L}\\p{N}])","iu").test(value); } catch { return false; } } return value.includes(a); }); }
export function safeWebUrl(value: unknown): string { if(typeof value!=="string") return ""; try {const url=new URL(value); return ["https:","http:"].includes(url.protocol)&&!url.username&&!url.password?url.href:"";} catch{return "";} }
export function articleKey(title:string,source:string){let t=title.trim();const suffix=" - "+source;if(source&&t.toLowerCase().endsWith(suffix.toLowerCase()))t=t.slice(0,-suffix.length).trim();return t.toLowerCase().replace(/[^\p{L}\p{N}]/gu,"").slice(0,160);}
