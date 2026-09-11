import type {Metadata} from "next";
import {Eye} from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy — Big Brother",
  description: "How Big Brother handles Google sign-in, workspace data, cookies, and shared boards.",
};

export default function PrivacyPage() {
  return <main className="legal-page">
    <header className="legal-header">
      <a className="legal-brand" href="/"><span className="sign-in-mark"><Eye size={22}/></span> big brother<span>.</span></a>
      <a className="secondary-button" href="/">Back to the workspace</a>
    </header>
    <article className="legal-body">
      <p className="eyebrow">PRIVACY</p>
      <h1>Privacy policy</h1>
      <p className="legal-updated">Effective 10 September 2026. This page is for the Big Brother instance at bigbrother-blue.vercel.app.</p>

      <section>
        <h2>Who runs this</h2>
        <p>Big Brother is a personal intelligence workspace: a private watchlist, relationship graph, notes, and optional shareable boards. This instance is operated by Minseo Kim. Contact <a href="mailto:vitaminseo04@gmail.com">vitaminseo04@gmail.com</a>.</p>
      </section>

      <section>
        <h2>What we collect</h2>
        <p>Nothing is stored against you until you sign in. After you sign in with Google we keep:</p>
        <ul>
          <li>A stable Google user id, used as your workspace owner. Google also returns email and profile so sign-in can complete; we do not save your Google email, name, or photo in the database.</li>
          <li>A signed session cookie so the browser stays signed in for up to 30 days.</li>
          <li>Workspace content you create or we collect for you: entities, connections, notes, attributes, boards, share links, and public RSS or news items matched to your watchlist.</li>
          <li>If you publish a board, view counts on that share link, and any suggestions a visitor sends to it (including the label they type).</li>
        </ul>
      </section>

      <section>
        <h2>Cookies</h2>
        <ul>
          <li><code>bb_session</code> — HttpOnly session. Set on sign-in, cleared on sign-out, lasts 30 days.</li>
          <li><code>bb_oauth_state</code> — short-lived CSRF token during Google sign-in, then deleted.</li>
        </ul>
        <p>These are first-party cookies. The app does not set advertising or tracking cookies.</p>
      </section>

      <section>
        <h2>How we use it</h2>
        <p>We use this data only to run your workspace: keep you signed in, load your private desk, fetch public sources you follow, and honour share links you create. We do not sell personal data, run ads, or use Google account data for advertising.</p>
      </section>

      <section>
        <h2>What other people can see</h2>
        <p>Your notes, unpublished boards, and account id are private to you. A shareable board link is the credential: anyone with it can read that board’s entities, connections, attributes, and public sources. Notes stay off the shared view; only a note count may appear. Revoking the link stops further access. Do not put secrets on a board you share.</p>
      </section>

      <section>
        <h2>Processors</h2>
        <ul>
          <li>Google — sign-in (OpenID, email, and profile scopes).</li>
          <li>Vercel — hosts the site and handles requests.</li>
          <li>Turso — stores workspace data in the United States.</li>
        </ul>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <p>Workspace rows stay until you ask us to delete them or this instance is taken down. Sign-out clears the session cookie immediately. There is no self-serve account-delete button yet; email the address above and we will delete your owner rows and session. Shared-board visitors are not given an account.</p>
      </section>

      <section>
        <h2>Children</h2>
        <p>This service is not directed at children under 13, and we do not knowingly collect their data.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If this policy changes in a material way, we will update this page and the date at the top.</p>
      </section>
    </article>
  </main>;
}
