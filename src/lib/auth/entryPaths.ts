/** First-entry auth screens: no app chrome, no tab bar, no someone-else's data. */
export function isAuthEntryPath(path: string): boolean {
  return path === "/connect" || path === "/welcome";
}
