"use client";
import {useEffect, useState} from "react";
import {Eye} from "lucide-react";

type Methods = {local: boolean; github: boolean; password: boolean};

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
      <p>Your watchlist, your connections and your notes are private to your account. Sign in to load them.</p>
      {methods?.github && <a className="primary-button" href="/api/auth/github">Sign in with GitHub</a>}
      {methods?.local && <a className={methods.github ? "secondary-button" : "primary-button"} href="/api/auth/local">Continue locally</a>}
      {methods?.password && <form onSubmit={event => void submitPassword(event)} className="desk-form">
        <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required/></label>
        <button className="primary-button" disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button>
      </form>}
      {methods && !methods.local && !methods.github && !methods.password && <p className="form-error" role="alert">No sign-in method is configured. Set AUTH_ALLOW_LOCAL, AUTH_PASSWORD, or GitHub OAuth.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="small-note">Nothing is stored against you until you sign in, and the workspace is only ever visible to you.</p>
    </div>
  </main>;
}
