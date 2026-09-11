"use client";
import {useEffect, useState} from "react";
import {Eye} from "lucide-react";

type Methods = {google: boolean; github: boolean; password: boolean};

function GoogleMark() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13.2 24 13.2c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.8-6.5 7.3l6.2 5.2C37.5 38.4 44 33 44 24c0-1.2-.1-2.3-.4-3.5z"/>
  </svg>;
}

export function SignIn() {
  const [methods, setMethods] = useState<Methods | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch("/api/auth/methods").then(async response => {
      if (!response.ok) throw new Error();
      setMethods(await response.json() as Methods);
    }).catch(() => setError("Sign-in options could not be loaded. Refresh and try again."));
  }, []);
  async function submitPassword(event: {preventDefault(): void}) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({password}),
      });
      const data = await response.json() as {error?: string};
      if (!response.ok) throw new Error(data.error ?? "That password is not right.");
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
      setBusy(false);
    }
  }
  return <main className="sign-in">
    <div className="sign-in-card">
      <span className="sign-in-mark"><Eye size={26}/></span>
      <h1>big brother<span>.</span></h1>
      <p className="eyebrow">PERSONAL INTELLIGENCE</p>
      <p>Your watchlist, your connections and your notes are private to your account. Sign in with Google to load them.</p>
      <a className="primary-button google-signin" href="/api/auth/google"><GoogleMark/> Sign in with Google</a>
      {methods?.github && <a className="secondary-button" href="/api/auth/github">Sign in with GitHub</a>}
      {methods?.password && <form onSubmit={event => void submitPassword(event)} className="desk-form">
        <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required/></label>
        <button className="primary-button" disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button>
      </form>}
      {methods && !methods.google && <p className="form-error" role="alert">Google sign-in is not configured on this deployment.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="small-note">Nothing is stored against you until you sign in, and the workspace is only ever visible to you. <a href="/privacy">Privacy</a></p>
    </div>
  </main>;
}
