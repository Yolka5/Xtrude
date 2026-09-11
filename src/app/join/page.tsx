import Link from "next/link";
import { redirect } from "next/navigation";
import { FlyItem } from "@/components/FlyItem";
import { getSessionUserId } from "@/lib/auth/currentUser";
import { joinLeagueByCode } from "@/lib/db/leagues";
import { connectPathWithInvite, planJoinLanding } from "@/lib/invite";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const sessionUserId = await getSessionUserId();
  const plan = planJoinLanding({ code: code ?? null, sessionUserId });

  if (plan.action === "connect") {
    redirect(connectPathWithInvite(plan.code));
  }

  if (plan.action === "join") {
    let leagueId: string | null = null;
    let error: string | null = null;
    try {
      leagueId = (await joinLeagueByCode(plan.userId, plan.code)).id;
    } catch (err) {
      error = err instanceof Error ? err.message : "That invite did not work.";
    }
    if (leagueId) redirect(`/league/?league=${leagueId}`);
    return (
      <JoinMessage title="Could not join" body={error ?? "That invite did not work."} />
    );
  }

  return (
    <JoinMessage
      title="Invite link is incomplete"
      body="This link needs a league join code. Ask the person who invited you for a new one, or enter the code on the League tab."
    />
  );
}

function JoinMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="screen">
      <FlyItem>
        <h1 className="screen__title">{title}</h1>
        <p className="t-body" style={{ margin: "0 4px 16px" }}>{body}</p>
        <Link href="/league/" className="text-btn text-btn--strong" style={{ paddingLeft: 4 }}>
          Open League
        </Link>
      </FlyItem>
    </main>
  );
}
