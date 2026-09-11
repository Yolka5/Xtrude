/**
 * The user this deployment currently acts as. No OAuth yet: every server
 * query is scoped to this id. Must match the `users` row inserted by
 * supabase/migrate-users.sql (and schema.sql on a fresh project).
 *
 * Override with XTRUDE_USER_ID only if that row's uuid ever changes.
 */
export const APP_USER_ID = process.env.XTRUDE_USER_ID || "e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70";
