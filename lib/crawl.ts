import {database} from "./store";
import {entityFeed,fetchFeed} from "./feeds";
import type {Entity} from "./intelligence";
export const BATCH=8;
// A feed is worth re-reading about once a day. Entities crawled inside the window are
// skipped entirely, so an idle workspace makes no outbound requests at all.
export const COOLDOWN_MS=24*60*60*1000;
export async function crawlDue(owner:string,entities:Entity[],batch=BATCH){const db=database();const cutoff=new Date(Date.now()-COOLDOWN_MS).toISOString();const due=await db.prepare("SELECT id,name,feed_url FROM entities WHERE owner_id=? AND followed=1 AND (last_crawled='' OR last_crawled<?) ORDER BY last_crawled ASC,rowid ASC LIMIT ?").bind(owner,cutoff,Math.max(1,Math.min(BATCH,batch))).all<{id:string;name:string;feed_url:string}>();const now=new Date().toISOString();if(due.results.length)await db.batch(due.results.map(e=>db.prepare("UPDATE entities SET last_crawled=? WHERE owner_id=? AND id=?").bind(now,owner,e.id)));return Promise.all(due.results.map(row=>{const entity=entities.find(e=>e.id===row.id);if(!entity)throw new Error("Entity not found.");const feed=entityFeed({...entity,feedUrl:row.feed_url});return fetchFeed({id:"entity:"+row.id,name:row.name,url:new URL(feed).origin,feed},entities);}));}
