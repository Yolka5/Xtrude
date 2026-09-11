import { ProfileContent } from "@/components/ProfileContent";
import { getAccountProfile, getRealData } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function ProfileScreen() {
  const [{ profile, records, badges, daily, hasAnyData }, account] = await Promise.all([
    getRealData(),
    getAccountProfile(),
  ]);
  return (
    <ProfileContent
      profile={profile}
      records={records}
      badges={badges}
      daily={daily}
      daysTracked={daily.length}
      hasAnyData={hasAnyData}
      displayName={account.displayName}
      memberSince={account.memberSince}
      imageUrl={account.imageUrl}
    />
  );
}
