/**
 * The Xtrude user who owns ONSHAPE_ACCESS_KEY / ONSHAPE_SECRET_KEY. Those
 * API keys are one Onshape account's credentials, so they may only ever
 * read or write that account's rows. This is NOT a fallback user: every
 * server path takes the signed-in (or iterated) user id explicitly, and a
 * missing id is an error, never this account.
 *
 * Must match the `users` row inserted by supabase/migrate-users.sql.
 * Override with XTRUDE_USER_ID only if that row's uuid ever changes.
 */
export const API_KEY_OWNER_ID = process.env.XTRUDE_USER_ID || "e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70";
