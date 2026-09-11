import {database,type SqliteStatement} from "@/db/sqlite";
import {initialEntities,articleKey,kindColor,type Article,type Entity,type Connection} from "./intelligence";
import {entitySources,seedConnections} from "./seeds";
import {aiMarketEntities} from "./ai-market";
import {importLimits, type ImportPlan} from "./import-file";
import {seedLayout} from "./graph-layout";

export {database};

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

export async function persistArticles(owner:string,list:Article[]){const db=database();const now=new Date().toISOString();const statements:SqliteStatement[]=[];for(const a of list){const id=articleKey(a.title,a.source);if(!id)continue;statements.push(db.prepare("INSERT INTO articles (owner_id,id,title,url,source,summary,published,first_seen) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,id) DO UPDATE SET url=excluded.url, summary=CASE WHEN excluded.summary<>'' THEN excluded.summary ELSE articles.summary END").bind(owner,id,a.title,a.url,a.source,a.summary??"",a.published,now));for(const entityId of a.entities){statements.push(db.prepare("INSERT OR IGNORE INTO article_entities (owner_id,article_id,entity_id) VALUES (?,?,?)").bind(owner,id,entityId));}}for(let i=0;i<statements.length;i+=100)await db.batch(statements.slice(i,i+100));}

export type BoardRow={id:string;name:string;pattern:string;patternColor:string;surface:string;gap:number;sort:number;image:string;imageFit:string;nodeScale:number;visibility:string;proposalAudience:string};
export async function ensureBoards(owner:string){const db=database();const existing=await db.prepare("SELECT count(*) AS total FROM boards WHERE owner_id=?").bind(owner).first<{total:number}>();if((existing?.total??0)>0)return;const id=crypto.randomUUID(),now=new Date().toISOString();const row=await db.prepare("SELECT value FROM settings WHERE owner_id=? AND key='layout'").bind(owner).first<{value:string}>();let layout:Record<string,[number,number]>={};try{if(row?.value)layout=JSON.parse(row.value) as Record<string,[number,number]>;}catch{}const entities=await db.prepare("SELECT id FROM entities WHERE owner_id=?").bind(owner).all<{id:string}>();const placements=entities.results.slice(0,100).map((entity,index)=>{const at=layout[entity.id]??[(index%5)*220-440,Math.floor(index/5)*180-180];return db.prepare("INSERT OR IGNORE INTO board_nodes (owner_id,board_id,entity_id,x,y) VALUES (?,?,?,?,?)").bind(owner,id,entity.id,Math.round(at[0]),Math.round(at[1]))});await db.batch([db.prepare("INSERT INTO boards (owner_id,id,name,pattern,pattern_color,surface,gap,sort,created) VALUES (?,?,?,?,?,?,?,?,?)").bind(owner,id,"AI Market Map","dots","#243641","#071018",22,0,now),...placements]);}
export async function listBoards(owner:string){await ensureBoards(owner);const db=database();const result=await db.prepare("SELECT id,name,pattern,pattern_color AS patternColor,surface,gap,sort,image,image_fit AS imageFit,node_scale AS nodeScale,visibility,proposal_audience AS proposalAudience FROM boards WHERE owner_id=? ORDER BY sort ASC,created ASC").bind(owner).all<BoardRow>();return result.results;}
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
  const board=await db.prepare("SELECT id,name,pattern,pattern_color AS patternColor,surface,gap,sort,image,image_fit AS imageFit,node_scale AS nodeScale,visibility,proposal_audience AS proposalAudience FROM boards WHERE owner_id=? AND id=?").bind(share.ownerId,share.boardId).first<BoardRow&{visibility:string;proposalAudience:string}>();
  if(!board)return null;
  const[placed,rows,links,counts,attributes,proposals,sources]=await Promise.all([
    db.prepare("SELECT entity_id AS id,x,y FROM board_nodes WHERE owner_id=? AND board_id=?").bind(share.ownerId,share.boardId).all<{id:string;x:number;y:number}>(),
    db.prepare("SELECT "+entityColumns+" FROM entities WHERE owner_id=? ORDER BY kind,name").bind(share.ownerId).all(),
    db.prepare("SELECT id,from_id AS 'from',to_id AS 'to',label,evidence,url,date,status FROM connections WHERE owner_id=? ORDER BY rowid").bind(share.ownerId).all(),
    db.prepare("SELECT target_id AS id,count(*) AS total FROM notes WHERE owner_id=? AND target_kind='entity' GROUP BY target_id").bind(share.ownerId).all<{id:string;total:number}>(),
    db.prepare("SELECT entity_id AS entityId,key,value,source_url AS sourceUrl,origin,contributor FROM entity_attributes WHERE owner_id=? ORDER BY entity_id,key").bind(share.ownerId).all<AttributeRow>(),
    db.prepare("SELECT id,kind,target_id AS targetId,payload,evidence_url AS evidenceUrl,message,contributor_label AS contributorLabel,created FROM contributions WHERE owner_id=? AND board_id=? AND status='pending' ORDER BY created DESC LIMIT 200").bind(share.ownerId,share.boardId).all<{id:string;kind:string;targetId:string;payload:string;evidenceUrl:string;message:string;contributorLabel:string;created:string}>(),
    db.prepare("SELECT connection_id AS connectionId,url,note,contributor FROM connection_sources WHERE owner_id=? ORDER BY added").bind(share.ownerId).all<{connectionId:string;url:string;note:string;contributor:string}>()
  ]);
  const layout=Object.fromEntries(placed.results.map(row=>[row.id,[row.x,row.y] as [number,number]]));
  const onBoard=new Set(Object.keys(layout));
  return {
    title:share.title,created:share.created,views:share.views,board,layout,
    entities:rows.results.map(mapEntity).filter(entity=>onBoard.has(entity.id)),
    connections:(links.results as unknown as Connection[]).filter(connection=>onBoard.has(connection.from)&&onBoard.has(connection.to)),
    noteCounts:Object.fromEntries(counts.results.filter(row=>onBoard.has(row.id)).map(row=>[row.id,Number(row.total)])),
    attributes:attributes.results.filter(row=>onBoard.has(row.entityId)),
    policy:{visibility:board.visibility,proposalAudience:board.proposalAudience},
    proposals:proposals.results.map(row=>{let payload:Record<string,unknown>={};try{payload=JSON.parse(row.payload) as Record<string,unknown>}catch{}return{...row,payload}}),
    sources:sources.results
  };
}
// The token names a board without telling its reader who owns it.
export async function shareTarget(token:string){return database().prepare("SELECT owner_id AS ownerId,board_id AS boardId FROM shares WHERE token=?").bind(token).first<{ownerId:string;boardId:string}>();}
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

// Profiles exist so a contribution can be attributed and an owner can decide who may
// send one. A person chooses how much of it is visible; nothing here is required to
// use the workspace alone.
export type ProfileRow={handle:string;displayName:string;bio:string;visibility:string};
export async function getProfile(person:string){return database().prepare("SELECT handle,display_name AS displayName,bio,visibility FROM profiles WHERE owner_id=?").bind(person).first<ProfileRow>();}
export async function findProfile(handle:string){return database().prepare("SELECT owner_id AS ownerId,handle,display_name AS displayName,visibility FROM profiles WHERE lower(handle)=lower(?)").bind(handle).first<ProfileRow&{ownerId:string}>();}
export async function saveProfile(person:string,change:{handle:string;displayName:string;bio:string;visibility:string}){
  const db=database();
  const taken=await db.prepare("SELECT owner_id AS ownerId FROM profiles WHERE lower(handle)=lower(?) AND owner_id<>?").bind(change.handle,person).first();
  if(taken)throw new Error("That handle is taken. Choose another.");
  await db.prepare("INSERT INTO profiles (owner_id,handle,display_name,bio,visibility,created) VALUES (?,?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET handle=excluded.handle,display_name=excluded.display_name,bio=excluded.bio,visibility=excluded.visibility").bind(person,change.handle,change.displayName,change.bio,change.visibility,new Date().toISOString()).run();
}
// The label a contribution travels under: a public profile shows its name, a quieter
// one stays a stable pseudonym rather than leaking the platform identity.
export async function contributorLabel(person:string){
  const profile=await getProfile(person);
  if(profile&&profile.visibility==="public")return profile.displayName||("@"+profile.handle);
  if(profile&&profile.visibility==="handle_only")return "@"+profile.handle;
  let hash=0;for(const character of person)hash=(hash*31+character.codePointAt(0)!)>>>0;
  return "Anonymous "+(hash%9000+1000);
}
function text(value:unknown,fallback=""){return typeof value==="string"?value:fallback;}
export type ContributionRow={id:string;boardId:string;kind:string;targetId:string;payload:string;evidenceUrl:string;message:string;contributor:string;contributorLabel:string;status:string;created:string;decided:string};
export const contributionKinds=["attribute","connection","entity","source"] as const;
export async function listContributions(owner:string,boardId:string,status="pending"){
  const result=await database().prepare("SELECT id,board_id AS boardId,kind,target_id AS targetId,payload,evidence_url AS evidenceUrl,message,contributor,contributor_label AS contributorLabel,status,created,decided FROM contributions WHERE owner_id=? AND board_id=? AND status=? ORDER BY created DESC LIMIT 500").bind(owner,boardId,status).all<ContributionRow>();
  return result.results;
}
export async function createContribution(owner:string,boardId:string,entry:{kind:string;targetId:string;payload:unknown;evidenceUrl:string;message:string;contributor:string;contributorLabel:string}){
  const db=database();
  const pending=await db.prepare("SELECT count(*) AS total FROM contributions WHERE owner_id=? AND board_id=? AND status='pending'").bind(owner,boardId).first<{total:number}>();
  if((pending?.total??0)>=500)throw new Error("This board's inbox is full. Ask its owner to clear it.");
  const mine=await db.prepare("SELECT count(*) AS total FROM contributions WHERE owner_id=? AND board_id=? AND contributor=? AND status='pending'").bind(owner,boardId,entry.contributor).first<{total:number}>();
  if((mine?.total??0)>=20)throw new Error("You have 20 suggestions waiting on this board. Give its owner a chance to read them.");
  const id=crypto.randomUUID();
  await db.prepare("INSERT INTO contributions (owner_id,id,board_id,kind,target_id,payload,evidence_url,message,contributor,contributor_label,status,created) VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?)").bind(owner,id,boardId,entry.kind,entry.targetId,JSON.stringify(entry.payload),entry.evidenceUrl,entry.message,entry.contributor,entry.contributorLabel,new Date().toISOString()).run();
  return id;
}
// Accepting is the only path from the suggestion layer into the workspace, and it
// keeps the source and the contributor attached to whatever it writes.
export async function decideContribution(owner:string,id:string,accept:boolean){
  const db=database();
  const row=await db.prepare("SELECT id,board_id AS boardId,kind,target_id AS targetId,payload,evidence_url AS evidenceUrl,contributor,contributor_label AS contributorLabel,status FROM contributions WHERE owner_id=? AND id=?").bind(owner,id).first<ContributionRow>();
  if(!row)return {ok:false,error:"That suggestion is no longer in the inbox."};
  if(row.status!=="pending")return {ok:false,error:"That suggestion has already been decided."};
  const now=new Date().toISOString();
  if(!accept){await db.prepare("UPDATE contributions SET status='declined',decided=? WHERE owner_id=? AND id=?").bind(now,owner,id).run();return {ok:true};}
  let payload:Record<string,unknown>={};
  try{payload=JSON.parse(row.payload) as Record<string,unknown>;}catch{return {ok:false,error:"That suggestion could not be read."};}
  if(row.kind==="attribute"){
    const entityId=text(payload.entityId,row.targetId),key=text(payload.key),value=text(payload.value);
    const exists=await db.prepare("SELECT id FROM entities WHERE owner_id=? AND id=?").bind(owner,entityId).first();
    if(!exists)return {ok:false,error:"The entity this suggestion described is gone."};
    await setAttribute(owner,entityId,key,value,row.evidenceUrl,"contribution",row.contributorLabel);
  }else if(row.kind==="connection"){
    const from=text(payload.from),to=text(payload.to);
    const nodes=await db.prepare("SELECT id FROM entities WHERE owner_id=? AND id IN (?,?)").bind(owner,from,to).all();
    if(nodes.results.length!==2)return {ok:false,error:"Both entities must still exist to accept this."};
    const connectionId=crypto.randomUUID();
    await db.batch([
      db.prepare("INSERT INTO connections (owner_id,id,from_id,to_id,label,evidence,url,date,status) VALUES (?,?,?,?,?,?,?,?,?)").bind(owner,connectionId,from,to,text(payload.label),text(payload.evidence),row.evidenceUrl,text(payload.date),payload.status==="Hypothesis"?"Hypothesis":"Documented"),
      db.prepare("INSERT OR IGNORE INTO connection_sources (owner_id,connection_id,url,note,contributor,added) VALUES (?,?,?,?,?,?)").bind(owner,connectionId,row.evidenceUrl,"Suggested",row.contributorLabel,now)
    ]);
  }else if(row.kind==="entity"){
    const name=text(payload.name).trim();
    const clash=await db.prepare("SELECT id FROM entities WHERE owner_id=? AND name_key=?").bind(owner,name.toLowerCase()).first<{id:string}>();
    const entityId=clash?.id??crypto.randomUUID();
    if(!clash){
      const kind=text(payload.kind,"Company").trim()||"Company";
      const initials=name.split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase();
      await db.prepare("INSERT INTO entities (owner_id,id,name,name_key,kind,initials,description,aliases,followed,source,color) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(owner,entityId,name,name.toLowerCase(),kind,initials,text(payload.description,"Suggested by a reader of this board."),JSON.stringify([name]),1,row.evidenceUrl,kindColor(kind)).run();
    }
    const count=await db.prepare("SELECT count(*) AS total FROM board_nodes WHERE owner_id=? AND board_id=?").bind(owner,row.boardId).first<{total:number}>();
    const slot=count?.total??0;
    await db.prepare("INSERT OR IGNORE INTO board_nodes (owner_id,board_id,entity_id,x,y) VALUES (?,?,?,?,?)").bind(owner,row.boardId,entityId,(slot%5)*220-440,Math.floor(slot/5)*180-180).run();
  }else if(row.kind==="source"){
    const connectionId=text(payload.connectionId,row.targetId);
    const exists=await db.prepare("SELECT id FROM connections WHERE owner_id=? AND id=?").bind(owner,connectionId).first();
    if(!exists)return {ok:false,error:"The connection this suggestion supported is gone."};
    await db.prepare("INSERT OR IGNORE INTO connection_sources (owner_id,connection_id,url,note,contributor,added) VALUES (?,?,?,?,?,?)").bind(owner,connectionId,row.evidenceUrl,text(payload.note),row.contributorLabel,now).run();
  }else return {ok:false,error:"That suggestion is of a kind this workspace does not accept."};
  await db.prepare("UPDATE contributions SET status='accepted',decided=? WHERE owner_id=? AND id=?").bind(now,owner,id).run();
  return {ok:true};
}
export async function listConnectionSources(owner:string){
  const result=await database().prepare("SELECT connection_id AS connectionId,url,note,contributor,added FROM connection_sources WHERE owner_id=? ORDER BY added").bind(owner).all<{connectionId:string;url:string;note:string;contributor:string;added:string}>();
  return result.results;
}
export async function boardAccessList(owner:string,boardId:string){
  const result=await database().prepare("SELECT a.person_id AS personId,a.role,p.handle,p.display_name AS displayName FROM board_access a LEFT JOIN profiles p ON p.owner_id=a.person_id WHERE a.owner_id=? AND a.board_id=? ORDER BY a.added").bind(owner,boardId).all<{personId:string;role:string;handle:string|null;displayName:string|null}>();
  return result.results;
}
export async function grantAccess(owner:string,boardId:string,handle:string,role:string){
  const profile=await findProfile(handle);
  if(!profile)return {ok:false,error:"No one here uses that handle. Ask them to set one up first."};
  if(profile.ownerId===owner)return {ok:false,error:"You already own this board."};
  await database().prepare("INSERT INTO board_access (owner_id,board_id,person_id,role,added) VALUES (?,?,?,?,?) ON CONFLICT(owner_id,board_id,person_id) DO UPDATE SET role=excluded.role").bind(owner,boardId,profile.ownerId,role,new Date().toISOString()).run();
  return {ok:true};
}
export async function revokeAccess(owner:string,boardId:string,personId:string){
  const result=await database().prepare("DELETE FROM board_access WHERE owner_id=? AND board_id=? AND person_id=?").bind(owner,boardId,personId).run();
  return Boolean(result.meta.changes);
}

export type ImportResult={
  boardId:string;
  name:string;
  created:number;
  reused:number;
  placed:number;
  connections:number;
  truncated:number;
};
function layoutImported(plan:ImportPlan):Record<string,[number,number]>{
  const placed=plan.entities.slice(0,importLimits.board);
  if(placed.length&&placed.every(entity=>entity.x!==undefined&&entity.y!==undefined)){
    return Object.fromEntries(placed.map(entity=>[entity.id,[entity.x!,entity.y!] as [number,number]]));
  }
  if(plan.connections.length){
    const layout=seedLayout(
      placed.map(entity=>({id:entity.id,name:entity.name,kind:entity.kind,initials:entity.initials,description:entity.description,aliases:entity.aliases,followed:entity.followed,source:entity.source,color:entity.color})),
      plan.connections.filter(connection=>placed.some(entity=>entity.id===connection.from)&&placed.some(entity=>entity.id===connection.to)).map((connection,index)=>({id:"import-"+index,from:connection.from,to:connection.to,label:connection.label,evidence:connection.evidence,url:connection.url,date:connection.date,status:connection.status}))
    );
    return Object.fromEntries(placed.map((entity,index)=>[entity.id,layout[entity.id]??[(index%5)*220-440,Math.floor(index/5)*180-180] as [number,number]]));
  }
  return Object.fromEntries(placed.map((entity,index)=>[entity.id,[(index%5)*220-440,Math.floor(index/5)*180-180] as [number,number]]));
}
export async function importDataframe(owner:string,plan:ImportPlan):Promise<ImportResult>{
  await initialize(owner);
  await ensureBoards(owner);
  const db=database();
  const entityCount=await db.prepare("SELECT count(*) AS total FROM entities WHERE owner_id=?").bind(owner).first<{total:number}>();
  const boardCount=await db.prepare("SELECT count(*) AS total FROM boards WHERE owner_id=?").bind(owner).first<{total:number}>();
  if((boardCount?.total??0)>=20)throw new Error("This workspace supports up to 20 boards. Delete one before importing another file.");
  const names=await db.prepare("SELECT name FROM boards WHERE owner_id=?").bind(owner).all<{name:string}>();
  const taken=new Set(names.results.map(row=>row.name.toLowerCase()));
  let boardName=plan.name.slice(0,60);
  for(let n=2;taken.has(boardName.toLowerCase());n+=1)boardName=(plan.name.slice(0,56)+" "+n).trim().slice(0,60);
  const existingIds=await db.prepare("SELECT id,name_key AS nameKey FROM entities WHERE owner_id=?").bind(owner).all<{id:string;nameKey:string}>();
  const byName=new Map(existingIds.results.map(row=>[row.nameKey,row.id]));
  const usedIds=new Set(existingIds.results.map(row=>row.id));
  const idMap=new Map<string,string>();
  const writes:SqliteStatement[]=[];
  let created=0,reused=0,skipped=0;
  let remaining=Math.max(0,500-(entityCount?.total??0));
  for(const entity of plan.entities){
    const nameKey=entity.name.toLowerCase();
    const already=byName.get(nameKey);
    if(already){idMap.set(entity.id,already);reused+=1;continue;}
    if(!remaining){skipped+=1;continue;}
    let id=entity.id;
    if(!id||usedIds.has(id))id=crypto.randomUUID();
    usedIds.add(id);
    byName.set(nameKey,id);
    idMap.set(entity.id,id);
    remaining-=1;
    created+=1;
    writes.push(db.prepare("INSERT INTO entities (owner_id,id,name,name_key,kind,initials,description,aliases,followed,source,color,feed_url,image) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(owner,id,entity.name,nameKey,entity.kind,entity.initials,entity.description,JSON.stringify(entity.aliases),entity.followed?1:0,entity.source,entity.color,entity.feedUrl,entity.image));
  }
  const remapped=plan.entities.map(entity=>{
    const id=idMap.get(entity.id);
    return id?{...entity,id}:null;
  }).filter((entity):entity is typeof plan.entities[number]=>Boolean(entity));
  if(!remapped.length)throw new Error("This workspace is full (500 entities). Remove some before importing.");
  for(const entity of remapped){
    for(const attribute of entity.attributes){
      writes.push(db.prepare("INSERT INTO entity_attributes (owner_id,entity_id,key,value,source_url,origin,contributor,updated) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,entity_id,key) DO UPDATE SET value=excluded.value,updated=excluded.updated").bind(owner,entity.id,attribute.key,attribute.value,"","owner","",new Date().toISOString()));
    }
  }
  const connections=plan.connections.flatMap(connection=>{
    const from=idMap.get(connection.from),to=idMap.get(connection.to);
    if(!from||!to||from===to)return [];
    return [{...connection,from,to,id:crypto.randomUUID()}];
  });
  for(const connection of connections){
    writes.push(db.prepare("INSERT INTO connections (owner_id,id,from_id,to_id,label,evidence,url,date,status) VALUES (?,?,?,?,?,?,?,?,?)").bind(owner,connection.id,connection.from,connection.to,connection.label,connection.evidence,connection.url,connection.date,connection.status));
  }
  for(let i=0;i<writes.length;i+=80)await db.batch(writes.slice(i,i+80));
  const layout=layoutImported({...plan,entities:remapped,connections:connections.map(({id:_id,...rest})=>rest)});
  const placed=Object.entries(layout).slice(0,importLimits.board);
  const boardId=crypto.randomUUID();
  const now=new Date().toISOString();
  await db.batch([
    db.prepare("INSERT INTO boards (owner_id,id,name,pattern,pattern_color,surface,gap,sort,created) VALUES (?,?,?,?,?,?,?,?,?)").bind(owner,boardId,boardName,"dots","#243641","#071018",22,boardCount?.total??0,now),
    ...placed.map(([entityId,at])=>db.prepare("INSERT OR IGNORE INTO board_nodes (owner_id,board_id,entity_id,x,y) VALUES (?,?,?,?,?)").bind(owner,boardId,entityId,at[0],at[1])),
  ]);
  return {boardId,name:boardName,created,reused,placed:placed.length,connections:connections.length,truncated:plan.truncated+skipped};
}
