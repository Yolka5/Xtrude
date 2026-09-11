/**
 * Copy for Today when the current user has zero sessions.
 * Never invents a streak, minutes, or records.
 */
export type FirstRunCopy = {
  headline: string;
  body: string;
  action: { href: string; label: string } | null;
};

export function firstRunCopy(opts: { hasAnyData: boolean; onshapeConnected: boolean }): FirstRunCopy | null {
  if (opts.hasAnyData) return null;
  if (!opts.onshapeConnected) {
    return {
      headline: "Connect Onshape to start",
      body: "Xtrude only counts time you actually model. Connect your account, then edit a document — nothing is on the board until then.",
      action: { href: "/connect/", label: "Connect Onshape" },
    };
  }
  return {
    headline: "Go model something",
    body: "You're connected. Open a tracked document in Onshape and save an edit. The first session shows up here. There is no streak yet.",
    action: null,
  };
}
