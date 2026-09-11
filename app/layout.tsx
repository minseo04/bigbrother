import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Big Brother — AI Market Intelligence", description: "Compare AI and AI-agent companies by product, target customer, revenue model, and market opportunity.", manifest:"/manifest.webmanifest", icons:{icon:"/favicon.svg",apple:"/icon-192.png"}, appleWebApp:{capable:true,title:"Big Brother AI",statusBarStyle:"default"} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
