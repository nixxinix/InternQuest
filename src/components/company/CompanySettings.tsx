"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { deleteCompanyAccount, updateCompanyDetails } from "@/app/actions/company";
import { FormError } from "@/components/auth/AuthShell";
import { BusinessHeader, HEADER_LINK } from "@/components/layout/BusinessHeader";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { websiteHost } from "@/lib/company/email";
import type { Company } from "@/lib/company/account";

export function CompanySettings({ company }: { company: Company }) {
  return (
    <ToastProvider>
      <Settings company={company} />
    </ToastProvider>
  );
}

function Settings({ company }: { company: Company }) {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(company.name);
  const [website, setWebsite] = useState(company.website.replace(/^https?:\/\//, ""));
  const [role, setRole] = useState(company.role);
  const [registrationNo, setRegistrationNo] = useState(company.registrationNo ?? "");
  const [tried, setTried] = useState(false);
  // Verified details are locked once approved (the server checks this too).
  const locked = company.status === "approved";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = tried && name.trim().length < 2 ? "Add your company's name." : undefined;
  const websiteError = tried && !websiteHost(website) ? "Add your company's website, like tanglaw.ph." : undefined;
  const roleError = tried && !role.trim() ? "Add your role, like HR Officer." : undefined;

  const submit = async () => {
    setTried(true);
    setError(null);
    if (nameError || websiteError || roleError) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    const res = await updateCompanyDetails({ companyName: name, website, role, registrationNo })
      .catch(() => ({ ok: false as const, error: "Couldn't reach InternQuest. Check your connection and try again." }));
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast({ tone: "success", message: company.status === "rejected" ? "Resubmitted for review." : "Saved." });
    router.push("/companies/dashboard");
  };

  return (
    <>
      <BusinessHeader area="for companies" home="/companies/dashboard">
        <Link href="/companies/dashboard" className={HEADER_LINK}>
          Your listings
        </Link>
      </BusinessHeader>
      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-gutter pb-16 pt-6 lg:pt-10">
        <Link href="/companies/dashboard" className="inline-flex min-h-tap items-center gap-1.5 font-semibold text-green underline-offset-4 hover:underline">
          <PixelIcon name="chevronRight" scale={2} className="rotate-180" />
          Your listings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold lg:text-3xl">Company details</h1>
        {company.status === "rejected" && (
          <p className="mt-2 border-l-4 border-alert bg-alert-tint p-3 text-base">
            We couldn&apos;t approve your company. Reason: {company.rejectReason ?? "Not given."}. Fix it below, then resubmit.
          </p>
        )}
        <p className="mt-2 text-base text-muted">
          {locked
            ? "Your work email, company name, and website were verified, so they can't be changed here. Your role and registration number can."
            : "Your work email can't be changed here. Everything else can."}
        </p>

        {error && (
          <div className="mt-5">
            <FormError message={error} />
          </div>
        )}

        <form
          ref={formRef}
          noValidate
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <TextField label="Work email" value={company.workEmail} disabled hint="The email you verified, used to log in." />
          <TextField label="Company name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" error={nameError} disabled={locked} />
          <TextField label="Company website" value={website} onChange={(e) => setWebsite(e.target.value)} inputMode="url" autoComplete="url" error={websiteError} disabled={locked} />
          <TextField label="Your role" value={role} onChange={(e) => setRole(e.target.value)} autoComplete="organization-title" error={roleError} />
          <TextField label="DTI or SEC registration number" optional value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} />
          <Button type="submit" size="lg" block loading={busy}>
            {company.status === "rejected" ? "Resubmit for review" : "Save changes"}
          </Button>
        </form>

        <DeleteCompany workEmail={company.workEmail} />
      </main>
    </>
  );
}

/** Two steps: open the confirm box, then type the work email. Nothing is deleted until the second button. */
function DeleteCompany({ workEmail }: { workEmail: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLElement>(null);
  const matches = typed.trim().toLowerCase() === workEmail.toLowerCase();

  const confirm = async () => {
    setError(null);
    setBusy(true);
    // On success the server signs out and sends the browser to /companies.
    const res = await deleteCompanyAccount(typed).catch(() => ({
      ok: false as const,
      error: "Couldn't reach InternQuest. Check your connection and try again.",
    }));
    setBusy(false);
    if (res && !res.ok) setError(res.error);
  };

  return (
    <section ref={boxRef} aria-labelledby="delete-company-h" className="mt-10 border-2 border-alert bg-screen p-4">
      <h2 id="delete-company-h" className="text-lg font-semibold">
        Delete company account
      </h2>
      <p className="mt-1 text-base text-muted">
        Deletes your account and drafts, and closes your published listings, right away. This can&apos;t be undone.
      </p>
      {!open ? (
        <Button
          variant="danger"
          className="mt-3"
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => boxRef.current?.querySelector("input")?.focus());
          }}
        >
          Delete company account
        </Button>
      ) : (
        <form
          noValidate
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (matches) void confirm();
          }}
        >
          {error && <FormError message={error} />}
          <TextField
            label={`Type ${workEmail} to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            inputMode="email"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" loading={busy} disabled={!matches}>
              Delete for good
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setTyped("");
                setError(null);
              }}
            >
              Keep my account
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
