import {env} from "cloudflare:workers";
import {initialEntities,articleKey,type Article,type Entity,type Connection} from "./intelligence";
import {entitySources,seedConnections} from "./seeds";
import {aiMarketEntities} from "./ai-market";

export function database(){if(!env.DB)throw new Error("Workspace storage is unavailable.");return env.DB;}

export async function initialize(owner:string){
  if(!owner)throw new Error("Authentication required.");
  const db=database();
  const legacy=await db.prepare("SELECT value FROM settings WHERE owner_id=? AND key=?").bind(owner,"seed-v1").first();
  if(!legacy)await db.batch([
    ...initialEntities.map(e=>db.prepare("INSERT OR IGNORE INTO entities (owner_id,id,name,name_key,kind,initials,description,aliases,followed,source,color) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(owner,e.id,e.name,e.name.toLowerCase(),e.kind,e.initials,e.description,JSON.stringify(e.aliases),1,entitySources[e.id]||"",e.color)),
    ...seedConnections.map(c=>db.prepare("INSERT OR IGNORE INTO connections (owner_id,id,from_id,to_id,label,evidence,url,date,status) VALUES (?,?,?,?,?,?,?,?,?)").bind(owner,c.id,c.from,c.to,c.label,c.evidence,c.url,c.date,c.status)),
    db.prepare("INSERT OR IGNORE INTO settings (owner_id,key,value) VALUES (?,?,?)").bind(owner,"seed-v1","done")
  ]);
  const market=await db.prepare("SELECT value FROM settings WHERE owner_id=? AND key=?").bind(owner,"ai-market-v2").first();
  if(!market){
    await db.prepare("DELETE FROM entities WHERE owner_id=? AND id=? AND name=?").bind(owner,"elic it","Elicit").run();
    const writes=aiMarketEntities.map(e=>db.prepare("INSERT INTO entities (owner_id,id,name,name_key,kind,initials,description,aliases,followed,source,color,market_profile) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,id) DO UPDATE SET kind=excluded.kind,description=excluded.description,aliases=excluded.aliases,source=excluded.source,color=excluded.color,market_profile=excluded.market_profile").bind(owner,e.id,e.name,e.name.toLowerCase(),e.kind,e.initials,e.description,JSON.stringify(e.aliases),1,e.source,e.color,JSON.stringify(e.profile)));
    for(let i=0;i<writes.length;i+=80)await db.batch(writes.slice(i,i+80));
    await db.prepare("INSERT OR IGNORE INTO settings (owner_id,key,value) VALUES (?,?,?)").bind(owner,"ai-market-v2","2026-09-09").run();
  }
}

const entityColumns="id,name,kind,initials,description,aliases,followed,source,color,image,feed_url AS feedUrl,last_crawled AS lastCrawled,market_profile AS marketProfile";
function mapEntity(row:Record<string,unknown>){let profile;try{const parsed=JSON.parse(row.marketProfile as string);if(parsed&&Object.keys(parsed).length)profile=parsed}catch{}const{marketProfile:_,...rest}=row;return{...rest,profile,aliases:JSON.parse(row.aliases as string),followed:Boolean(row.followed)} as Entity;}

export async function getWorkspace(owner:string){
  await initialize(owner);
  const db=database();
  const[e,c]=await Promise.all([
    db.prepare("SELECT "+entityColumns+" FROM entities WHERE owner_id=? ORDER BY CASE WHEN market_profile='{}' THEN 1 ELSE 0 END, kind, name").bind(owner).all(),
    db.prepare("SELECT id,from_id AS 'from',to_id AS 'to',label,evidence,url,date,status FROM connections WHERE owner_id=? ORDER BY rowid").bind(owner).all()
  ]);
  return {entities:e.results.map(mapEntity),connections:c.results as Connection[]};
}

export async function persistArticles(owner:string,list:Article[]){const db=database();const now=new Date().toISOString();const statements:D1PreparedStatement[]=[];for(const a of list){const id=articleKey(a.title,a.source);if(!id)continue;statements.push(db.prepare("INSERT INTO articles (owner_id,id,title,url,source,summary,published,first_seen) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,id) DO UPDATE SET url=excluded.url, summary=CASE WHEN excluded.summary<>'' THEN excluded.summary ELSE articles.summary END").bind(owner,id,a.title,a.url,a.source,a.summary??"",a.published,now));for(const entityId of a.entities){statements.push(db.prepare("INSERT OR IGNORE INTO article_entities (owner_id,article_id,entity_id) VALUES (?,?,?)").bind(owner,id,entityId));}}for(let i=0;i<statements.length;i+=100)await db.batch(statements.slice(i,i+100));}

export type BoardRow={id:string;name:string;pattern:string;patternColor:string;surface:string;gap:number;sort:number;image:string;imageFit:string;nodeScale:number};
export async function ensureBoards(owner:string){const db=database();const existing=await db.prepare("SELECT count(*) AS total FROM boards WHERE owner_id=?").bind(owner).first<{total:number}>();if((existing?.total??0)>0)return;const id=crypto.randomUUID(),now=new Date().toISOString();const row=await db.prepare("SELECT value FROM settings WHERE owner_id=? AND key='layout'").bind(owner).first<{value:string}>();let layout:Record<string,[number,number]>={};try{if(row?.value)layout=JSON.parse(row.value) as Record<string,[number,number]>;}catch{}const entities=await db.prepare("SELECT id FROM entities WHERE owner_id=?").bind(owner).all<{id:string}>();const placements=entities.results.slice(0,100).map((entity,index)=>{const at=layout[entity.id]??[(index%5)*220-440,Math.floor(index/5)*180-180];return db.prepare("INSERT OR IGNORE INTO board_nodes (owner_id,board_id,entity_id,x,y) VALUES (?,?,?,?,?)").bind(owner,id,entity.id,Math.round(at[0]),Math.round(at[1]))});await db.batch([db.prepare("INSERT INTO boards (owner_id,id,name,pattern,pattern_color,surface,gap,sort,created) VALUES (?,?,?,?,?,?,?,?,?)").bind(owner,id,"AI Market Map","dots","#243641","#071018",22,0,now),...placements]);}
export async function listBoards(owner:string){await ensureBoards(owner);const db=database();const result=await db.prepare("SELECT id,name,pattern,pattern_color AS patternColor,surface,gap,sort,image,image_fit AS imageFit,node_scale AS nodeScale FROM boards WHERE owner_id=? ORDER BY sort ASC,created ASC").bind(owner).all<BoardRow>();return result.results;}
export async function boardLayout(owner:string,boardId:string){const db=database();const result=await db.prepare("SELECT entity_id AS id,x,y FROM board_nodes WHERE owner_id=? AND board_id=?").bind(owner,boardId).all<{id:string;x:number;y:number}>();return Object.fromEntries(result.results.map(row=>[row.id,[row.x,row.y] as [number,number]]));}

// Sharing. A token is the only credential a visitor needs, so it is 128 bits of
// randomness, it names one board rather than the whole workspace, and deleting the
// row is the revoke. Notes stay private: a shared board carries their count, never
// their text.
export type ShareRow={token:string;boardId:string;title:string;created:string;views:number;lastViewed:string};
function shareToken(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,"0")).join("");}
export async function listShares(owner:string){const db=database();const result=await db.prepare("SELECT token,board_id AS boardId,title,created,views,last_viewed AS lastViewed FROM shares WHERE owner_id=? ORDER BY created DESC").bind(owner).all<ShareRow>();return result.results;}
export async function createShare(owner:string,boardId:string){
  const db=database();
  const board=await db.prepare("SELECT id,name FROM boards WHERE owner_id=? AND id=?").bind(owner,boardId).first<{id:string;name:string}>();
  if(!board)return null;
  const existing=await db.prepare("SELECT token FROM shares WHERE owner_id=? AND board_id=?").bind(owner,boardId).first<{token:string}>();
  if(existing)return existing.token;
  const count=await db.prepare("SELECT count(*) AS total FROM shares WHERE owner_id=?").bind(owner).first<{total:number}>();
  if((count?.total??0)>=20)throw new Error("This workspace supports up to 20 share links. Revoke one before creating another.");
  const token=shareToken();
  await db.prepare("INSERT INTO shares (token,owner_id,board_id,title,created) VALUES (?,?,?,?,?)").bind(token,owner,boardId,board.name,new Date().toISOString()).run();
  return token;
}
export async function revokeShare(owner:string,token:string){const db=database();const result=await db.prepare("DELETE FROM shares WHERE owner_id=? AND token=?").bind(owner,token).run();return Boolean(result.meta.changes);}
export async function renameShare(owner:string,token:string,title:string){const db=database();const result=await db.prepare("UPDATE shares SET title=? WHERE owner_id=? AND token=?").bind(title,owner,token).run();return Boolean(result.meta.changes);}
export async function sharedProject(token:string){
  const db=database();
  const share=await db.prepare("SELECT owner_id AS ownerId,board_id AS boardId,title,created,views FROM shares WHERE token=?").bind(token).first<{ownerId:string;boardId:string;title:string;created:string;views:number}>();
  if(!share)return null;
  const board=await db.prepare("SELECT id,name,pattern,pattern_color AS patternColor,surface,gap,sort,image,image_fit AS imageFit,node_scale AS nodeScale FROM boards WHERE owner_id=? AND id=?").bind(share.ownerId,share.boardId).first<BoardRow>();
  if(!board)return null;
  const[placed,rows,links,counts,attributes]=await Promise.all([
    db.prepare("SELECT entity_id AS id,x,y FROM board_nodes WHERE owner_id=? AND board_id=?").bind(share.ownerId,share.boardId).all<{id:string;x:number;y:number}>(),
    db.prepare("SELECT "+entityColumns+" FROM entities WHERE owner_id=? ORDER BY kind,name").bind(share.ownerId).all(),
    db.prepare("SELECT id,from_id AS 'from',to_id AS 'to',label,evidence,url,date,status FROM connections WHERE owner_id=? ORDER BY rowid").bind(share.ownerId).all(),
    db.prepare("SELECT target_id AS id,count(*) AS total FROM notes WHERE owner_id=? AND target_kind='entity' GROUP BY target_id").bind(share.ownerId).all<{id:string;total:number}>(),
    db.prepare("SELECT entity_id AS entityId,key,value,source_url AS sourceUrl,origin,contributor FROM entity_attributes WHERE owner_id=? ORDER BY entity_id,key").bind(share.ownerId).all<AttributeRow>()
  ]);
  const layout=Object.fromEntries(placed.results.map(row=>[row.id,[row.x,row.y] as [number,number]]));
  const onBoard=new Set(Object.keys(layout));
  return {
    title:share.title,created:share.created,views:share.views,board,layout,
    entities:rows.results.map(mapEntity).filter(entity=>onBoard.has(entity.id)),
    connections:(links.results as unknown as Connection[]).filter(connection=>onBoard.has(connection.from)&&onBoard.has(connection.to)),
    noteCounts:Object.fromEntries(counts.results.filter(row=>onBoard.has(row.id)).map(row=>[row.id,Number(row.total)])),
    attributes:attributes.results.filter(row=>onBoard.has(row.entityId))
  };
}
export async function recordShareView(token:string){const db=database();await db.prepare("UPDATE shares SET views=views+1,last_viewed=? WHERE token=?").bind(new Date().toISOString(),token).run();}

// Attributes are the columns of the table view: anything a workspace wants to record
// about an entity beyond the seeded market profile. Each value carries the source it
// came from, the same discipline connections already follow.
export type AttributeRow={entityId:string;key:string;value:string;sourceUrl:string;origin:string;contributor:string};
export const attributeLimits={perEntity:40,key:40,value:200};
export async function listAttributes(owner:string){const db=database();const result=await db.prepare("SELECT entity_id AS entityId,key,value,source_url AS sourceUrl,origin,contributor FROM entity_attributes WHERE owner_id=? ORDER BY entity_id,key").bind(owner).all<AttributeRow>();return result.results;}
export async function setAttribute(owner:string,entityId:string,key:string,value:string,sourceUrl:string,origin="owner",contributor=""){
  const db=database();
  // Keys are matched without case so "HQ" and "hq" stay one column; the first spelling wins.
  const existing=await db.prepare("SELECT key FROM entity_attributes WHERE owner_id=? AND entity_id=? AND lower(key)=lower(?)").bind(owner,entityId,key).first<{key:string}>();
  if(!existing){const count=await db.prepare("SELECT count(*) AS total FROM entity_attributes WHERE owner_id=? AND entity_id=?").bind(owner,entityId).first<{total:number}>();if((count?.total??0)>=attributeLimits.perEntity)throw new Error("An entity holds up to "+attributeLimits.perEntity+" attributes. Remove one before adding another.");}
  await db.prepare("INSERT INTO entity_attributes (owner_id,entity_id,key,value,source_url,origin,contributor,updated) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,entity_id,key) DO UPDATE SET value=excluded.value,source_url=excluded.source_url,origin=excluded.origin,contributor=excluded.contributor,updated=excluded.updated").bind(owner,entityId,existing?.key??key,value,sourceUrl,origin,contributor,new Date().toISOString()).run();
  return existing?.key??key;
}
export async function deleteAttribute(owner:string,entityId:string,key:string){const db=database();const result=await db.prepare("DELETE FROM entity_attributes WHERE owner_id=? AND entity_id=? AND lower(key)=lower(?)").bind(owner,entityId,key).run();return Boolean(result.meta.changes);}
