import "server-only";

/**
 * Outbound email, used for the company email-confirmation link (SPEC §12).
 * Off unless RESEND_API_KEY is set (Resend's free tier covers a pilot): the
 * registration flow still works without it, just without that one signal,
 * and admin can confirm an address by hand during review instead.
 */
export function isEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendEmail(to: string, subject: string, text: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "Email sending isn't configured." };
  const from = process.env.RESEND_FROM || "InternQuest <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] Resend answered", res.status, body.slice(0, 300));
      return { ok: false, error: `Email service answered ${res.status}.` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] send failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "Couldn't reach the email service." };
  }
}
