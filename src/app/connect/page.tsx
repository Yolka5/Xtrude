import Link from "next/link";
import { redirect } from "next/navigation";
import { FlyItem } from "@/components/FlyItem";
import { Icon } from "@/components/Icon";
import { getSessionUserId } from "@/lib/auth/currentUser";
import { getHandleForUser } from "@/lib/db/handles";
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
    const handle = await getHandleForUser(sessionUserId);
    redirect(handle ? safeNextPath(next) ?? "/" : "/welcome/");
  }
  const message = error ? ERRORS[error] ?? "Something went wrong signing in." : null;
  const startHref = oauthStartPath(next ?? null);
  const invited = Boolean(inviteCodeFromNext(next ?? null));

  return (
    <main className="screen">
      <FlyItem>
        <h1 className="screen__title">Log in</h1>
        <p className="screen__subtitle t-subhead">Or sign up — connecting Onshape creates your account.</p>
      </FlyItem>

      <FlyItem>
        <section className="chunk" style={{ padding: "22px 18px" }}>
          <div className="stack" style={{ gap: 12 }}>
            <p className="t-body" style={{ margin: 0 }}>
              Xtrude is per Onshape account. Log in with yours so you see your
              sessions, not someone else&apos;s.
            </p>
            <ul className="t-footnote dim" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              <li>New here? Continue with Onshape to create an Xtrude account.</li>
              <li>Already connected? Same button logs you back in.</li>
              <li>After that you pick your @ handle.</li>
              {invited ? <li>Then you land in the league you were invited to.</li> : null}
            </ul>
            {message ? (
              <p className="t-footnote" style={{ margin: 0, color: "var(--neg, #b42318)" }}>
                {message}
              </p>
            ) : null}
            <Link
              href={startHref}
              className="text-btn text-btn--strong"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                minHeight: 48,
                padding: "0 18px",
                borderRadius: "var(--r-chip)",
                background: "var(--label)",
                color: "var(--surface)",
                width: "fit-content",
              }}
            >
              <Icon name="doc" size={18} />
              Continue with Onshape
            </Link>
            <p className="t-caption dimmer" style={{ margin: 0 }}>
              We request read access to your profile and documents. Tokens stay on
              the server.
            </p>
          </div>
        </section>
      </FlyItem>
    </main>
  );
}
