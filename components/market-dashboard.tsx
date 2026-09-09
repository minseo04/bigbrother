"use client";
import {useMemo,useState,type CSSProperties} from "react";
import {ArrowUpRight,Building2,Filter,Lightbulb,MapPin,Search,ShieldCheck,Sparkles,Users2} from "lucide-react";
import type {Entity} from "@/lib/intelligence";

type Props={entities:Entity[];query:string;onSelect:(entity:Entity)=>void};
type Sort="opportunity"|"name"|"newest";
const ALL="전체";

export function MarketDashboard({entities,query,onSelect}:Props){
  const market=useMemo(()=>entities.filter(entity=>entity.profile),[entities]);
  const layers=useMemo(()=>[...new Set(market.map(entity=>entity.profile!.layer))].sort(),[market]);
  const verticals=useMemo(()=>[...new Set(market.map(entity=>entity.profile!.vertical))].sort(),[market]);
  const[layer,setLayer]=useState(ALL),[vertical,setVertical]=useState(ALL),[startupsOnly,setStartupsOnly]=useState(true),[sort,setSort]=useState<Sort>("opportunity");
  const needle=query.trim().toLowerCase();
  const shown=useMemo(()=>market.filter(entity=>{
    const p=entity.profile!;
    const haystack=[entity.name,p.layer,p.vertical,p.targetCustomer,p.revenueModel,p.products.join(" "),p.tags.join(" ")].join(" ").toLowerCase();
    return (!needle||haystack.includes(needle))&&(layer===ALL||p.layer===layer)&&(vertical===ALL||p.vertical===vertical)&&(!startupsOnly||p.startup);
  }).sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="newest"?b.profile!.founded-a.profile!.founded:b.profile!.opportunityScore-a.profile!.opportunityScore),[market,needle,layer,vertical,startupsOnly,sort]);
  const startupCount=market.filter(entity=>entity.profile!.startup).length;
  const highOpportunity=market.filter(entity=>entity.profile!.opportunityScore>=65).length;
  const topVertical=[...verticals].map(name=>({name,count:market.filter(entity=>entity.profile!.vertical===name).length})).sort((a,b)=>b.count-a.count)[0];
  return <section className="market-dashboard">
    <header className="market-heading">
      <div><span className="market-kicker"><Sparkles size={13}/> AI MARKET INTELLIGENCE</span><h1>사업기회 탐색 보드</h1><p>제품·고객·수익모델을 같은 기준으로 비교하고, 아직 덜 붐비는 진입점을 찾습니다.</p></div>
      <div className="verified-chip"><ShieldCheck size={15}/><span>공개 자료 기반</span><strong>2026.09.09</strong></div>
    </header>
    <div className="market-stats">
      <article><Building2/><span>분석 기업</span><strong>{market.length}</strong><small>글로벌 AI 플레이어</small></article>
      <article><Sparkles/><span>스타트업</span><strong>{startupCount}</strong><small>초기~후기 단계</small></article>
      <article><Lightbulb/><span>기회 점수 65+</span><strong>{highOpportunity}</strong><small>진입 여지 높은 영역</small></article>
      <article><Users2/><span>최다 경쟁 영역</span><strong>{topVertical?.count??0}</strong><small>{topVertical?.name??"—"}</small></article>
    </div>
    <div className="market-controls">
      <div className="filter-block"><span><Filter size={13}/> 기술 레이어</span><div className="market-pills"><button className={layer===ALL?"active":""} onClick={()=>setLayer(ALL)}>전체 <b>{market.length}</b></button>{layers.map(name=><button key={name} className={layer===name?"active":""} onClick={()=>setLayer(name)}>{name} <b>{market.filter(entity=>entity.profile!.layer===name).length}</b></button>)}</div></div>
      <div className="filter-row">
        <label>산업<select value={vertical} onChange={event=>setVertical(event.target.value)}><option>{ALL}</option>{verticals.map(name=><option key={name}>{name}</option>)}</select></label>
        <label>정렬<select value={sort} onChange={event=>setSort(event.target.value as Sort)}><option value="opportunity">사업기회 높은 순</option><option value="newest">설립연도 최신 순</option><option value="name">회사명 순</option></select></label>
        <button className={startupsOnly?"startup-toggle active":"startup-toggle"} onClick={()=>setStartupsOnly(value=>!value)} aria-pressed={startupsOnly}><span/> 스타트업만</button>
        <div className="result-count">{shown.length}개 결과</div>
      </div>
    </div>
    <div className="company-grid">
      {shown.map(entity=>{const p=entity.profile!;return <article key={entity.id} className="company-card" onClick={()=>onSelect(entity)} tabIndex={0} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onSelect(entity)}}}>
        <div className="company-card-top"><span className="company-mark" style={{"--entity-color":entity.color} as CSSProperties}>{entity.initials}</span><div><h2>{entity.name}</h2><p><MapPin size={11}/>{p.hq} · {p.founded}</p></div><span className={"stage-badge "+(p.startup?"":"incumbent")}>{p.stage}</span></div>
        <div className="company-tags"><span>{p.layer}</span><span>{p.vertical}</span>{p.tags.slice(0,2).map(tag=><span key={tag}>#{tag}</span>)}</div>
        <div className="company-section"><small>핵심 제품</small><strong>{p.products.slice(0,2).join(" · ")}</strong></div>
        <div className="company-section"><small>타겟 고객</small><p>{p.targetCustomer}</p></div>
        <div className="company-section revenue"><small>수익모델</small><p>{p.revenueModel}</p></div>
        <div className="opportunity-row"><div><span>사업기회</span><strong>{p.opportunityScore}</strong></div><div className="score-track"><i style={{width:p.opportunityScore+"%"}}/></div><button onClick={event=>{event.stopPropagation();onSelect(entity)}}>상세 분석 <ArrowUpRight size={13}/></button></div>
      </article>})}
      {!shown.length&&<div className="market-empty"><Search size={22}/><strong>조건에 맞는 기업이 없습니다.</strong><span>검색어나 필터를 바꿔보세요.</span></div>}
    </div>
    <footer className="market-method"><ShieldCheck size={14}/><span>수익모델은 공개 가격표와 제품 설명을 표준화한 분석값입니다. ‘사업기회 점수’는 경쟁 강도, 구매 의사, 워크플로우 명확성, 방어 가능성을 종합한 탐색용 지표이며 투자 조언이 아닙니다.</span></footer>
  </section>;
}
