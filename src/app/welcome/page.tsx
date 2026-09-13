import { redirect } from "next/navigation";
import { FlyItem } from "@/components/FlyItem";
import { HandleForm } from "@/components/HandleForm";
import { getSessionUserId } from "@/lib/auth/currentUser";
import { getHandleForUser } from "@/lib/db/handles";
import { safeNextPath } from "@/lib/invite";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/connect/");
  const handle = await getHandleForUser(userId);
  const { next } = await searchParams;
  const dest = safeNextPath(next) ?? "/";
  if (handle) redirect(dest);

  return (
    <main className="screen">
      <FlyItem>
        <h1 className="screen__title">Choose your @</h1>
        <p className="screen__subtitle t-subhead">This is your handle on Profile and in leagues. You can change it later.</p>
      </FlyItem>
      <FlyItem>
        <HandleForm nextPath={dest} submitLabel="Continue" />
      </FlyItem>
    </main>
  );
}
