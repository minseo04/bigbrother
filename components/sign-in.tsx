"use client";
import {Eye} from "lucide-react";
// Shown instead of the workspace whenever the API answers 401. The graph must not
// render in this state: app/page.tsx seeds its entity state from initialEntities, so
// an unauthenticated shell draws fifteen real-looking nodes backed by nothing.
export function SignIn(){
  return <main className="sign-in">
    <div className="sign-in-card">
      <span className="sign-in-mark"><Eye size={26}/></span>
      <h1>big brother<span>.</span></h1>
      <p className="eyebrow">PERSONAL INTELLIGENCE</p>
      <p>Your watchlist, your connections and your notes are private to your account. Sign in to load them.</p>
      {/* Served by @openai/sites-vite-plugin middleware, not the app router: client-side
          navigation would never reach it, so this has to be a real document request. */}
      {/* eslint-disable-next-line next/no-html-link-for-pages */}
      <a className="primary-button" href="/signin-with-chatgpt">Sign in with ChatGPT</a>
      <p className="small-note">Nothing is stored against you until you sign in, and the workspace is only ever visible to you.</p>
    </div>
  </main>;
}
