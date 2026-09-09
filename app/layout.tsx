import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Big Brother — AI Market Intelligence", description: "AI와 AI 에이전트 기업의 제품, 고객, 수익모델과 사업기회를 한곳에서 비교하는 시장 인텔리전스 대시보드.", manifest:"/manifest.webmanifest", icons:{icon:"/favicon.svg",apple:"/icon-192.png"}, appleWebApp:{capable:true,title:"Big Brother AI",statusBarStyle:"default"} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ko"><body>{children}</body></html>; }
