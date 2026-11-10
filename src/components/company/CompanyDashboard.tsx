"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { closeListing, companyLogOut, deleteDraft, reopenListing } from "@/app/actions/company";
import { BusinessHeader, HEADER_LINK } from "@/components/layout/BusinessHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { Tag } from "@/components/ui/Tag";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import type { Company, CompanyPosting, CompanyPostingStatus } from "@/lib/company/account";

type Tab = CompanyPostingStatus;
const TAB_LABEL: Record<Tab, string> = { active: "Active", draft: "Drafts", closed: "Closed" };

/** W13 company dashboard (USER_FLOWS §7.5, §7.8). No game elements. */
export function CompanyDashboard({ company, initialPostings }: { company: Company; initialPostings: CompanyPosting[] }) {
  return (
    <ToastProvider>
      <Dashboard company={company} initialPostings={initialPostings} />
    </ToastProvider>
  );
}

function Dashboard({ company, initialPostings }: { company: Company; initialPostings: CompanyPosting[] }) {
  const params = useSearchParams();
  const toast = useToast();
  const [postings, setPostings] = useState(initialPostings);
  const [tab, setTab] = useState<Tab>(company.status === "approved" ? "active" : "draft");
  const [closing, setClosing] = useState<CompanyPosting | null>(null);
  const [deleting, setDeleting] = useState<CompanyPosting | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // A "Saved"/"Confirmed" message after coming back from another action (once per visit).
  const saved = params.get("saved");
  const confirmed = params.get("confirmed");
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    if (saved) {
      toast({
        tone: "success",
        message:
          saved === "published"
            ? "Published. Interns can see it now."
            : company.approved
              ? "Saved as a draft."
              : "Saved as a draft. It goes live when your company is approved.",
      });
    } else if (confirmed === "1") {
      toast({ tone: "success", message: "Email confirmed. Thanks." });
    } else if (confirmed === "0") {
      toast({ tone: "error", message: "That confirmation link didn't work. It may have expired." });
    }
  }, [saved, confirmed, company.approved, toast]);

  const counts = { active: 0, draft: 0, closed: 0 } as Record<Tab, number>;
  for (const p of postings) counts[p.status]++;
  const list = postings.filter((p) => p.status === tab);
  const editHref = (p: CompanyPosting) => `/companies/listings/new?id=${p.id}`;

  const closeListingNow = async (p: CompanyPosting) => {
    setClosing(null);
    setBusyId(p.id);
    const before = postings;
    setPostings((all) => all.map((x) => (x.id === p.id ? { ...x, status: "closed" as const, updatedDaysAgo: 0 } : x)));
    const res = await closeListing(p.id).catch(() => ({ ok: false as const, error: "Couldn't reach InternQuest." }));
    setBusyId(null);
    if (!res.ok) {
      setPostings(before);
      toast({ tone: "error", message: res.error });
      return;
    }
    toast({ message: `Closed "${p.title}". Interns no longer see it.` });
  };

  const reopen = async (p: CompanyPosting) => {
    setBusyId(p.id);
    const res = await reopenListing(p.id).catch(() => ({ ok: false as const, error: "Couldn't reach InternQuest." }));
    setBusyId(null);
    if (!res.ok) {
      toast({ tone: "error", message: res.error });
      return;
    }
    setPostings((all) => all.map((x) => (x.id === p.id ? { ...x, status: "active" as const, updatedDaysAgo: 0 } : x)));
    toast({ tone: "success", message: `Posted "${p.title}" again.` });
  };

  const deleteDraftNow = async (p: CompanyPosting) => {
    setDeleting(null);
    setBusyId(p.id);
    const before = postings;
    setPostings((all) => all.filter((x) => x.id !== p.id));
    const res = await deleteDraft(p.id).catch(() => ({ ok: false as const, error: "Couldn't reach InternQuest." }));
    setBusyId(null);
    if (!res.ok) {
      setPostings(before);
      toast({ tone: "error", message: res.error });
      return;
    }
    toast({ message: `Deleted the draft "${p.title}".` });
  };

  return (
    <>
      <BusinessHeader area="for companies" home="/companies/dashboard">
        <span className="hidden px-3 text-sm text-bezel-text sm:inline">{company.name}</span>
        <Link href="/companies/settings" className={HEADER_LINK}>
          Settings
        </Link>
        <form action={companyLogOut}>
          <button type="submit" className={HEADER_LINK}>
            Log out
          </button>
        </form>
      </BusinessHeader>
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-gutter pb-16 pt-6 lg:pt-10">
        {company.status === "pending" && (
          <div role="status" className="mb-5 flex items-start gap-3 border-l-4 border-ink bg-screen p-4">
            <PixelIcon name="clock" scale={3} className="mt-0.5 flex-none" />
            <div>
              <p className="font-semibold">Your company is under review.</p>
              <p className="text-base text-muted">
                A person checks your details, usually within a few working days. You can write drafts now, and they go live
                after approval.
              </p>
            </div>
          </div>
        )}
        {company.status === "rejected" && (
          <div role="alert" className="mb-5 flex items-start gap-3 border-l-4 border-alert bg-alert-tint p-4">
            <PixelIcon name="alert" scale={3} className="mt-0.5 flex-none text-alert" />
            <div>
              <p className="font-semibold">We couldn&apos;t approve your company.</p>
              <p className="text-base">Reason: {company.rejectReason ?? "Not given."}.</p>
              <p className="mt-1 text-base">Fix that, then resubmit for review. Your drafts are kept.</p>
              <ButtonLink href="/companies/settings" variant="secondary" className="mt-3">
                Fix my details
              </ButtonLink>
            </div>
          </div>
        )}
        {!company.emailConfirmed && company.status !== "suspended" && (
          <p className="mb-5 border-l-4 border-muted bg-canvas p-3 text-sm text-muted">
            We haven&apos;t confirmed your work email yet. Check your inbox for a link from us, or ask during review.
          </p>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold lg:text-3xl">Your listings</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-base text-muted">
              {company.name}
              {company.approved && <Tag tone="verified">Verified</Tag>}
            </p>
          </div>
          <ButtonLink href="/companies/listings/new" icon={<PixelIcon name="plus" scale={2} />}>
            New listing
          </ButtonLink>
        </div>

        <div className="mt-6">
          <Tabs
            label="Listing status"
            value={tab}
            onChange={(id) => setTab(id as Tab)}
            tabs={(["active", "draft", "closed"] as Tab[]).map((t) => ({ id: t, label: TAB_LABEL[t], count: counts[t] }))}
          >
            {list.length === 0 ? (
              <EmptyState
                title={tab === "active" ? "No active listings" : tab === "draft" ? "No drafts" : "Nothing closed yet"}
                body={
                  tab === "active"
                    ? company.approved
                      ? "Post a listing and it shows up for matching interns right away."
                      : "Listings go live after your company is approved. Start a draft now."
                    : tab === "draft"
                      ? "Drafts you save show up here."
                      : "Listings you close, or that pass their deadline, show up here."
                }
              />
            ) : (
              <ul className="grid gap-3">
                {list.map((p) => (
                  <li key={p.id} className="border border-line bg-screen p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="text-lg font-semibold">{p.title}</h2>
                      <span className="bg-canvas px-2 text-sm font-semibold">{TAB_LABEL[p.status].replace(/s$/, "")}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{postingLine(p)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.status !== "closed" && (
                        <ButtonLink href={editHref(p)} variant="secondary">
                          Edit
                        </ButtonLink>
                      )}
                      {p.status === "active" && (
                        <Button variant="ghost" loading={busyId === p.id} onClick={() => setClosing(p)}>
                          Close listing
                        </Button>
                      )}
                      {p.status === "draft" && (
                        <Button variant="ghost" loading={busyId === p.id} onClick={() => setDeleting(p)}>
                          Delete draft
                        </Button>
                      )}
                      {p.status === "closed" && (
                        <Button variant="secondary" loading={busyId === p.id} onClick={() => void reopen(p)}>
                          Post again
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Tabs>
          <p className="mt-4 text-sm text-muted">Apply clicks are totals. You never see who clicked until they apply to you.</p>
        </div>
      </main>

      <Sheet open={closing !== null} onClose={() => setClosing(null)} title={`Close "${closing?.title ?? ""}"?`} description="It stops showing to interns right away. Interns who saved it will see it as closed.">
        <div className="grid gap-2">
          <Button variant="danger" block onClick={() => closing && void closeListingNow(closing)}>
            Close listing
          </Button>
          <Button variant="secondary" block onClick={() => setClosing(null)}>
            Keep it open
          </Button>
        </div>
      </Sheet>
      <Sheet open={deleting !== null} onClose={() => setDeleting(null)} title={`Delete the draft "${deleting?.title ?? ""}"?`}>
        <div className="grid gap-2">
          <Button variant="danger" block onClick={() => deleting && void deleteDraftNow(deleting)}>
            Delete draft
          </Button>
          <Button variant="secondary" block onClick={() => setDeleting(null)}>
            Keep it
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function postingLine(p: CompanyPosting): string {
  const clicks = `${p.applyClicks} apply ${p.applyClicks === 1 ? "click" : "clicks"}`;
  if (p.status === "draft") return `Draft · edited ${p.updatedDaysAgo === 0 ? "today" : `${p.updatedDaysAgo} ${p.updatedDaysAgo === 1 ? "day" : "days"} ago`}`;
  if (p.status === "closed") return `${clicks} · closed`;
  const due = p.deadlineInDays === null ? "no deadline" : p.deadlineInDays <= 0 ? "closes today" : `closes in ${p.deadlineInDays} ${p.deadlineInDays === 1 ? "day" : "days"}`;
  return `${clicks} · ${due}`;
}
