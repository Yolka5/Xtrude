import { ProfileContent } from "@/components/ProfileContent";
import { requireAppUser } from "@/lib/auth/requireAppUser";
import { getAccountProfile, getRealData } from "@/lib/db/queries";
import { displayHandle } from "@/lib/profileFields";

export const dynamic = "force-dynamic";

export default async function ProfileScreen() {
  await requireAppUser();
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
      handle={displayHandle(account.handle)}
    />
  );
}
