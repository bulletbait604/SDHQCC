/**
 * Opt-in only: set NEXT_PUBLIC_SHOW_NEW_TOOL_TAB=1 in .env.local (or Vercel Preview) to
 * show the in-progress tab. Omit in production until release.
 */
export function isNewToolTabEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_SHOW_NEW_TOOL_TAB?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
