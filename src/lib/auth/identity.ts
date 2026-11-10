/**
 * Supabase Auth needs an email, but InternQuest only asks for a username
 * (SPEC §4, option a). Each username maps to a private internal address that
 * never receives mail. Users never see it, and it isn't stored anywhere else.
 *
 * `.invalid` is reserved by RFC 2606, so this can never be a real mailbox.
 * Changing the domain after people have signed up would lock them out, so it
 * is fixed in code rather than read from the environment.
 */
import { normalizeUsername } from "./validation";

export const INTERNAL_EMAIL_DOMAIN = "users.internquest.invalid";

export function internalEmail(username: string): string {
  return `${normalizeUsername(username)}@${INTERNAL_EMAIL_DOMAIN}`;
}

export function isInternalEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}
