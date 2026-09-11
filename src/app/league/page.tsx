import { LeagueContent } from "@/components/LeagueContent";
import { getLeagueView } from "@/lib/db/leagues";
import { APP_USER_ID } from "../../../scripts/lib/appUser.mjs";

export const dynamic = "force-dynamic";

export default async function LeagueScreen() {
  const league = await getLeagueView(APP_USER_ID);
  return <LeagueContent league={league} lonely={league.memberCount <= 1} />;
}
