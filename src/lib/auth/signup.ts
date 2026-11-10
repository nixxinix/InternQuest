/**
 * The sign-up form's rules, checked again on the server (never trust the form).
 * Pure, so it is unit tested.
 */
import { validatePassword, validateUsername } from "./validation";

export type SignUpInput = {
  username: string;
  password: string;
  /** Ticked "I agree to the privacy notice". */
  consent: boolean;
  /** Ticked "I'm 18 or older, or I have my parent's or guardian's permission". */
  ageOk: boolean;
};

export type SignUpField = "username" | "password" | "consent" | "ageOk";
export type SignUpErrors = Partial<Record<SignUpField | "form", string>>;

export type SignUpCheck = { ok: true; username: string; password: string } | { ok: false; errors: SignUpErrors };

export const CONSENT_ERROR = "Tick this box to continue. It's how you give us the OK to store your data.";
export const AGE_ERROR = "Tick this box to continue. Under 18? Ask a parent or guardian first.";

export function validateSignUp(input: SignUpInput): SignUpCheck {
  const errors: SignUpErrors = {};
  const u = validateUsername(typeof input.username === "string" ? input.username : "");
  if (!u.ok) errors.username = u.error;
  const password = typeof input.password === "string" ? input.password : "";
  const p = validatePassword(password, u.value);
  if (!p.ok) errors.password = p.error;
  // Strictly `true`: a missing or truthy-but-not-boolean value doesn't count as consent.
  if (input.consent !== true) errors.consent = CONSENT_ERROR;
  if (input.ageOk !== true) errors.ageOk = AGE_ERROR;
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, username: u.value, password };
}
