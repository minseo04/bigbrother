import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Big Brother — Intelligence Desk", description: "Your private desk for public information. Follow people, companies, governments, and technology; explore sourced connections and daily briefings.", manifest:"/manifest.webmanifest", icons:{icon:"/favicon.svg",apple:"/icon-192.png"}, appleWebApp:{capable:true,title:"Big Brother",statusBarStyle:"default"} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
