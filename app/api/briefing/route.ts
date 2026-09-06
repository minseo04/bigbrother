import {authenticatedUser,unauthorized} from "@/lib/access";
import {database,getWorkspace,initialize,persistArticles} from "@/lib/store";
import {fetchFeed,newsSources} from "@/lib/feeds";
import {crawlDue,BATCH} from "@/lib/crawl";
import type {Briefing,Article} from "@/lib/intelligence";
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
const pendingByOwner=new Map<string,Promise<Briefing>>();
export async function GET(request:Request){const owner=authenticatedUser(request);if(!owner)return unauthorized();try{await initialize(owner);const db=database();const params=new URL(request.url).searchParams;if(params.get("archive")==="1"){const result=await db.prepare("SELECT date FROM briefings WHERE owner_id=? ORDER BY date DESC LIMIT 60").bind(owner).all();return json({dates:result.results.map(r=>r.date)});}
const today=new Date().toISOString().slice(0,10);const requested=params.get("date");if(requested&&!/^\d{4}-\d{2}-\d{2}$/.test(requested))return json({error:"Invalid edition date."},400);const day=requested||today;const cached=await db.prepare("SELECT content,updated FROM briefings WHERE owner_id=? AND date=?").bind(owner,day).first<{content:string;updated:string}>();
if(requested)return cached?json(JSON.parse(cached.content)):json({error:"No briefing was saved on that date."},404);
if(cached&&Date.now()-Date.parse(cached.updated)<20*60000)return json(JSON.parse(cached.content));
let pending=pendingByOwner.get(owner);if(!pending){pending=(async()=>{const {entities}=await getWorkspace(owner);const sources=newsSources();const fixed=await Promise.all(sources.map(s=>fetchFeed(s,entities)));const crawled=await crawlDue(owner,entities,BATCH);const results=[...fixed,...crawled];console.info("Feed refresh",{fixed:fixed.length,entity:crawled.length,outbound:fixed.length+crawled.length});const seen=new Set<string>();const seenTitles=new Set<string>();const articles:Article[]=results.flatMap(r=>r.articles).sort((a,b)=>b.published.localeCompare(a.published)).filter(a=>{const title=a.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");if(seen.has(a.url)||seenTitles.has(title))return false;seen.add(a.url);seenTitles.add(title);return true}).slice(0,200);
try{await persistArticles(owner,results.flatMap(r=>r.articles));}catch(e){console.error("Article persistence failed",e);}
const previous=cached?JSON.parse(cached.content) as Briefing:null;const allFailed=results.every(r=>r.source.status==="error");const edition:Briefing={date:today,updated:new Date().toISOString(),articles:allFailed&&previous?previous.articles:articles.map(a=>({id:a.id,title:a.title,url:a.url,source:a.source,published:a.published,entities:a.entities})),sources:results.map(r=>r.source)};
if(!allFailed)await db.prepare("INSERT INTO briefings (owner_id,date,content,updated) VALUES (?,?,?,?) ON CONFLICT(owner_id,date) DO UPDATE SET content=excluded.content,updated=excluded.updated").bind(owner,today,JSON.stringify(edition),edition.updated).run();return edition;})().finally(()=>{pendingByOwner.delete(owner)});pendingByOwner.set(owner,pending);}return json(await pending);
}catch(e){console.error("Briefing failed",e);return json({error:"The briefing is temporarily unavailable. Your saved workspace is safe."},503)}}

