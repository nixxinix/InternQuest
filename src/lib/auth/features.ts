/**
 * Recovery by email needs an email-sending service (custom SMTP, for example
 * Resend's free tier). Supabase's built-in mailer only delivers to the
 * project's own team, so it can't send resets to users. Until a service is
 * connected, recovery codes are the only reset method and the email option
 * is hidden everywhere, so nobody picks a method that can't work.
 */
export const EMAIL_RECOVERY_AVAILABLE = false;
