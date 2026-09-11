import Link from "next/link";
import { FlyItem } from "@/components/FlyItem";
import { Icon } from "@/components/Icon";

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
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERRORS[error] ?? "Something went wrong signing in." : null;

  return (
    <main className="screen">
      <FlyItem>
        <h1 className="screen__title">Xtrude</h1>
        <p className="screen__subtitle t-subhead">Modeled time, measured from what you actually built.</p>
      </FlyItem>

      <FlyItem>
        <section className="chunk" style={{ padding: "22px 18px" }}>
          <div className="stack" style={{ gap: 12 }}>
            <p className="t-body" style={{ margin: 0 }}>
              Connect your Onshape account. Xtrude watches the documents you touch
              and turns real edits into sessions, streaks, and a league.
            </p>
            {message ? (
              <p className="t-footnote" style={{ margin: 0, color: "var(--neg, #b42318)" }}>
                {message}
              </p>
            ) : null}
            <Link
              href="/api/auth/onshape/start"
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
              Connect Onshape
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
