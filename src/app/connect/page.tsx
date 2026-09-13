import Link from "next/link";
import { redirect } from "next/navigation";
import { FlyItem } from "@/components/FlyItem";
import { getSessionUserId } from "@/lib/auth/currentUser";
import { ensureHandleForUser } from "@/lib/db/handles";
import { oauthStartPath, inviteCodeFromNext, safeNextPath } from "@/lib/invite";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  denied: "Onshape did not grant access.",
  bad_state: "That sign-in link expired. Try again.",
  missing_code: "Onshape did not send a code back. Try again.",
  token_exchange: "Could not exchange the Onshape code for tokens.",
  sessioninfo: "Could not read your Onshape profile.",
  user: "Could not create or match your Xtrude account.",
  token_store: "Signed in, but token storage failed. Run migrate-oauth.sql and retry.",
  missing_auth_secret: "AUTH_SECRET or CRON_SECRET is not set on the server.",
  missing_oauth_app: "Onshape OAuth client id/secret are not set.",
};

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const sessionUserId = await getSessionUserId();
  if (sessionUserId && !error) {
    const handle = await ensureHandleForUser(sessionUserId);
    redirect(handle ? safeNextPath(next) ?? "/" : "/welcome/");
  }
  const message = error ? ERRORS[error] ?? "Something went wrong signing in." : null;
  const startHref = oauthStartPath(next ?? null);
  const invited = Boolean(inviteCodeFromNext(next ?? null));

  return (
    <main className="screen screen--entry">
      <FlyItem>
        <p className="t-footnote dim" style={{ margin: "0 0 8px" }}>Xtrude</p>
        <h1 className="screen__title">Log in or sign up</h1>
        <p className="screen__subtitle t-subhead">
          First time here starts on this screen — not someone else&apos;s profile.
        </p>
      </FlyItem>

      <FlyItem>
        <section className="chunk" style={{ padding: "22px 18px" }}>
          <div className="stack" style={{ gap: 14 }}>
            <p className="t-body" style={{ margin: 0 }}>
              Use your own Onshape account. That creates your Xtrude user, your
              name, and your @. It never opens as an existing member.
            </p>
            {invited ? (
              <p className="t-footnote dim" style={{ margin: 0 }}>
                After you connect, you join the league you were invited to.
              </p>
            ) : null}
            {message ? (
              <p className="t-footnote" style={{ margin: 0, color: "var(--neg, #b42318)" }}>
                {message}
              </p>
            ) : null}
            <Link href={startHref} className="btn btn-prism btn-block">
              Sign up with Onshape
            </Link>
            <Link href={startHref} className="btn btn-secondary btn-block">
              Log in with Onshape
            </Link>
            <p className="t-caption dimmer" style={{ margin: 0 }}>
              Same Onshape button either way. New accounts are created on first
              connect. We request read access to your profile and documents.
            </p>
          </div>
        </section>
      </FlyItem>
    </main>
  );
}
