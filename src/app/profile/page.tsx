import { ProfileContent } from "@/components/ProfileContent";
import { getRealData } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function ProfileScreen() {
  const { profile, records, badges, daily, hasAnyData } = await getRealData();
  return (
    <ProfileContent
      profile={profile}
      records={records}
      badges={badges}
      daily={daily}
      daysTracked={daily.length}
      hasAnyData={hasAnyData}
    />
  );
}
