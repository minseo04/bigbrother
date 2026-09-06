const DAY=86_400_000;
export function timelineIsUseful(from:string,to:string,full:boolean){return Boolean(full&&(Date.parse(to)-Date.parse(from))/DAY>=90);}