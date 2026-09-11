import { LeagueContent } from "@/components/LeagueContent";
import { getLeagueView } from "@/lib/db/leagues";
import { getCurrentUserId } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";

export default async function LeagueScreen() {
  const league = await getLeagueView(await getCurrentUserId());
  return <LeagueContent league={league} lonely={league.memberCount <= 1} />;
}
