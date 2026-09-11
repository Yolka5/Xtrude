import { LeagueContent } from "@/components/LeagueContent";
import { LeagueManage } from "@/components/LeagueManage";
import { getLeagueView } from "@/lib/db/leagues";
import { getCurrentUserId } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";

export default async function LeagueScreen({
  searchParams,
}: {
  searchParams: Promise<{ league?: string }>;
}) {
  const { league: leagueId } = await searchParams;
  const league = await getLeagueView(await getCurrentUserId(), leagueId);
  return (
    <LeagueContent league={league} lonely={league.memberCount <= 1}>
      <LeagueManage
        leagueId={league.id}
        leagueName={league.name}
        joinCode={league.joinCode}
        isOwner={league.isOwner}
        allLeagues={league.allLeagues}
        tablesReady={league.tablesReady}
      />
    </LeagueContent>
  );
}
