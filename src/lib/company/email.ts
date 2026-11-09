/**
 * Company email rules (SPEC §12). Pure, so the free-email block and the admin
 * "domain matches website" check are tested and identical on the server.
 */

/** Free email providers that can't prove a company (decision S5: no manual exceptions in v1). */
export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.com.ph",
  "ymail.com",
  "rocketmail.com",
  "outlook.com",
  "outlook.ph",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "mail.com",
  "zohomail.com",
  "yandex.com",
  "tutanota.com",
  "tuta.io",
]);

export function emailDomain(email: string): string | null {
  const m = email.trim().toLowerCase().match(/^[^\s@]+@([a-z0-9.-]+\.[a-z]{2,})$/);
  return m ? m[1] : null;
}

export function isFreeEmail(email: string): boolean {
  const d = emailDomain(email);
  return d !== null && FREE_EMAIL_DOMAINS.has(d);
}

/** "https://www.tanglaw.ph/about" -> "tanglaw.ph". null when it isn't an http(s) address. */
export function websiteHost(website: string): string | null {
  const raw = website.trim();
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** True when the email's domain is the website's domain, or a subdomain of either (hr.tanglaw.ph / tanglaw.ph). */
export function domainMatchesWebsite(email: string, website: string): boolean {
  const d = emailDomain(email);
  const h = websiteHost(website);
  if (!d || !h) return false;
  return d === h || d.endsWith(`.${h}`) || h.endsWith(`.${d}`);
}

export type CompanyRegistration = {
  companyName: string;
  website: string;
  email: string;
  role: string;
  registrationNo: string;
  consent: boolean;
};

export type RegistrationErrors = Partial<Record<keyof CompanyRegistration, string>>;

export function validateRegistration(r: CompanyRegistration): RegistrationErrors {
  const e: RegistrationErrors = {};
  const name = r.companyName.trim();
  if (name.length < 2) e.companyName = "Add your company's name.";
  else if (name.length > 100) e.companyName = "Keep it under 100 characters.";
  if (!websiteHost(r.website)) e.website = "Add your company's website, like tanglaw.ph.";
  if (!emailDomain(r.email)) e.email = "That doesn't look like an email address yet.";
  else if (isFreeEmail(r.email)) e.email = "We need an email on your company's own domain to verify you.";
  if (!r.role.trim()) e.role = "Add your role, like HR Officer.";
  else if (r.role.trim().length > 60) e.role = "Keep it under 60 characters.";
  if (r.registrationNo.trim().length > 40) e.registrationNo = "Keep it under 40 characters.";
  if (!r.consent) e.consent = "Tick this box to continue.";
  return e;
}
