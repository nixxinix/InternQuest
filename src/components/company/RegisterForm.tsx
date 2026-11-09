"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox, PasswordField, TextField } from "@/components/ui/Field";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { validatePassword } from "@/lib/auth/validation";
import { isFreeEmail, validateRegistration, type CompanyRegistration } from "@/lib/company/email";

const EMPTY: CompanyRegistration = { companyName: "", website: "", email: "", role: "", registrationNo: "", consent: false };

/**
 * W13 register (USER_FLOWS §7.2–3). Companies sign in with their work email,
 * unlike interns. TODO(Phase 6): server action creates the account, sends the
 * confirmation link, and puts the company in the admin queue.
 */
export function RegisterForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [r, setR] = useState(EMPTY);
  const [password, setPassword] = useState(""); // never stored
  const [tried, setTried] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const errors = validateRegistration(r);
  const pw = validatePassword(password, r.email.split("@")[0] ?? "");
  // The free-email message shows as soon as the domain is typed: it's the one thing people can't fix by retrying.
  const emailError = tried || isFreeEmail(r.email) ? errors.email : undefined;
  const show = (k: keyof CompanyRegistration) => (tried ? errors[k] : undefined);
  const set = (patch: Partial<CompanyRegistration>) => setR((v) => ({ ...v, ...patch }));

  if (sentTo) {
    return (
      <div className="border border-line bg-screen p-6">
        <PixelIcon name="check" scale={4} className="text-green" />
        <h1 className="mt-3 text-2xl font-semibold">Check your email</h1>
        <p className="mt-2 text-base">
          We sent a confirmation link to <span className="font-semibold">{sentTo}</span>. Open it to confirm the address. After
          that, a person reviews your company, and you can write drafts in the meantime.
        </p>
        <p className="mt-3 text-sm text-muted">Nothing after a few minutes? Check your spam folder, or ask your IT team whether outside emails are blocked.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink href="/companies/dashboard?state=pending">Continue (demo)</ButtonLink>
          <Button variant="secondary" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold lg:text-3xl">Register your company</h1>
      <p className="mt-1 text-base text-muted">It&apos;s free. A person reviews every company before its listings go live.</p>
      <form
        ref={formRef}
        noValidate
        className="mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (Object.keys(errors).length > 0 || !pw.ok) {
            requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
            return;
          }
          setSentTo(r.email.trim());
        }}
      >
        <TextField label="Company name" value={r.companyName} onChange={(e) => set({ companyName: e.target.value })} autoComplete="organization" error={show("companyName")} />
        <TextField
          label="Company website"
          value={r.website}
          onChange={(e) => set({ website: e.target.value })}
          inputMode="url"
          autoComplete="url"
          placeholder="e.g. tanglaw.ph"
          error={show("website")}
        />
        <TextField
          label="Work email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={r.email}
          onChange={(e) => set({ email: e.target.value })}
          hint="On your company's own domain, like hr@tanglaw.ph. It's also how you log in."
          error={emailError}
        />
        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          hint="At least 10 characters. A short sentence works well."
          error={tried && !pw.ok ? pw.error : undefined}
        />
        <TextField label="Your role" value={r.role} onChange={(e) => set({ role: e.target.value })} placeholder="e.g. HR Officer" autoComplete="organization-title" error={show("role")} />
        <TextField
          label="DTI or SEC registration number"
          optional
          value={r.registrationNo}
          onChange={(e) => set({ registrationNo: e.target.value })}
          hint="Helps us approve you faster."
          error={show("registrationNo")}
        />
        <Checkbox
          checked={r.consent}
          onChange={(e) => set({ consent: e.target.checked })}
          error={show("consent")}
          label={
            <>
              I agree that InternQuest stores these details to verify my company, as described in the{" "}
              <Link href="/privacy" className="font-semibold text-green underline decoration-2 underline-offset-4">
                privacy notice
              </Link>
              . Listings must never ask interns to pay.
            </>
          }
        />
        <Button type="submit" size="lg" block>
          Register
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Only have a Gmail or Yahoo address? We can&apos;t verify those yet. A company website with its own email domain is
        needed to post.
      </p>
    </>
  );
}
