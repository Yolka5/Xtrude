import Link from "next/link";
import { getSessionUserId } from "@/lib/auth/currentUser";
import { userNeedsReauth } from "@/lib/auth/tokens";

export async function ReauthBanner() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  if (!(await userNeedsReauth(userId))) return null;

  return (
    <div
      role="status"
      style={{
        margin: "0 auto",
        maxWidth: 640,
        padding: "10px 16px",
        background: "color-mix(in srgb, var(--neg, #b42318) 12%, var(--surface))",
        color: "var(--label)",
        fontSize: 14,
        fontWeight: 700,
        textAlign: "center",
      }}
    >
      Onshape access expired.{" "}
      <Link href="/connect/" style={{ color: "inherit", textDecoration: "underline" }}>
        Reconnect
      </Link>{" "}
      to keep tracking.
    </div>
  );
}
