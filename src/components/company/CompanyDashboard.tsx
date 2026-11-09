"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BusinessHeader, HEADER_LINK } from "@/components/layout/BusinessHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { Tag } from "@/components/ui/Tag";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { SAMPLE_COMPANY, SAMPLE_POSTINGS, type CompanyPosting, type CompanyStatus } from "@/lib/sample/company";

type Tab = CompanyPosting["status"];
const TAB_LABEL: Record<Tab, string> = { active: "Active", draft: "Drafts", closed: "Closed" };

/**
 * W13 company dashboard (USER_FLOWS §7.5, §7.8). No game elements: this
 * component never uses GameModeProvider. DESIGN PREVIEW: sample company.
 * Review switches: ?state=pending|approved|rejected, ?saved=draft|published.
 */
export function CompanyDashboard() {
  return (
    <ToastProvider>
      <Dashboard />
    </ToastProvider>
  );
}

function Dashboard() {
  const params = useSearchParams();
  const toast = useToast();
  const stateParam = params.get("state");
  const status: CompanyStatus = stateParam === "pending" || stateParam === "rejected" ? stateParam : "approved";
  // Not approved yet: only drafts exist (they publish on approval).
  const [postings, setPostings] = useState(() => (status === "approved" ? SAMPLE_POSTINGS : SAMPLE_POSTINGS.filter((p) => p.status === "draft")));
  const [tab, setTab] = useState<Tab>(status === "approved" ? "active" : "draft");
  const [closing, setClosing] = useState<CompanyPosting | null>(null);
  const [deleting, setDeleting] = useState<CompanyPosting | null>(null);

  // A "Saved" message after coming back from the post form (once per visit).
  const saved = params.get("saved");
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current || !saved) return;
    announced.current = true;
    toast({
      tone: "success",
      message:
        saved === "published"
          ? "Published. Interns can see it now."
          : status === "approved"
            ? "Saved as a draft."
            : "Saved as a draft. It goes live when your company is approved.",
    });
  }, [saved, status, toast]);

  const counts = { active: 0, draft: 0, closed: 0 } as Record<Tab, number>;
  for (const p of postings) counts[p.status]++;
  const list = postings.filter((p) => p.status === tab);
  const editHref = (p: CompanyPosting) => `/companies/listings/new?id=${p.id}${status !== "approved" ? `&state=${status}` : ""}`;

  const closeListing = (p: CompanyPosting) => {
    const before = postings;
    // TODO(Phase 6): server action sets is_active = false; interns who saved it see "closed".
    setPostings((all) => all.map((x) => (x.id === p.id ? { ...x, status: "closed", updatedDaysAgo: 0 } : x)));
    setClosing(null);
    toast({ message: `Closed “${p.title}”. Interns no longer see it.`, action: { label: "Undo", onClick: () => setPostings(before) } });
  };
  const deleteDraft = (p: CompanyPosting) => {
    const before = postings;
    setPostings((all) => all.filter((x) => x.id !== p.id));
    setDeleting(null);
    toast({ message: `Deleted the draft “${p.title}”.`, action: { label: "Undo", onClick: () => setPostings(before) } });
  };

  return (
    <>
      <BusinessHeader area="for companies" home="/companies/dashboard">
        <span className="hidden px-3 text-sm text-bezel-text sm:inline">{SAMPLE_COMPANY.name}</span>
        <Link href="/companies" className={HEADER_LINK}>
          Log out
        </Link>
      </BusinessHeader>
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-gutter pb-16 pt-6 lg:pt-10">
        {status === "pending" && (
          <div role="status" className="mb-5 flex items-start gap-3 border-l-4 border-ink bg-screen p-4">
            <PixelIcon name="clock" scale={3} className="mt-0.5 flex-none" />
            <div>
              <p className="font-semibold">Your company is under review.</p>
              <p className="text-base text-muted">We&apos;ll email you when you&apos;re approved. You can write drafts now, and they go live after approval.</p>
            </div>
          </div>
        )}
        {status === "rejected" && (
          <div role="alert" className="mb-5 flex items-start gap-3 border-l-4 border-alert bg-alert-tint p-4">
            <PixelIcon name="alert" scale={3} className="mt-0.5 flex-none text-alert" />
            <div>
              <p className="font-semibold">We couldn&apos;t approve your company.</p>
              <p className="text-base">Reason: {SAMPLE_COMPANY.rejectReason}.</p>
              <p className="mt-1 text-base">Fix that, then register again. Your drafts are kept.</p>
              <ButtonLink href="/companies/register" variant="secondary" className="mt-3">
                Register again
              </ButtonLink>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold lg:text-3xl">Your listings</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-base text-muted">
              {SAMPLE_COMPANY.name}
              {status === "approved" && <Tag tone="verified">Verified</Tag>}
            </p>
          </div>
          <ButtonLink href={`/companies/listings/new${status !== "approved" ? `?state=${status}` : ""}`} icon={<PixelIcon name="plus" scale={2} />}>
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
                    ? status === "approved"
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
                        <Button variant="ghost" onClick={() => setClosing(p)}>
                          Close listing
                        </Button>
                      )}
                      {p.status === "draft" && (
                        <Button variant="ghost" onClick={() => setDeleting(p)}>
                          Delete draft
                        </Button>
                      )}
                      {p.status === "closed" && (
                        <ButtonLink href={editHref(p)} variant="secondary">
                          Post again
                        </ButtonLink>
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

      <Sheet open={closing !== null} onClose={() => setClosing(null)} title={`Close “${closing?.title ?? ""}”?`} description="It stops showing to interns right away. Interns who saved it will see it as closed.">
        <div className="grid gap-2">
          <Button variant="danger" block onClick={() => closing && closeListing(closing)}>
            Close listing
          </Button>
          <Button variant="secondary" block onClick={() => setClosing(null)}>
            Keep it open
          </Button>
        </div>
      </Sheet>
      <Sheet open={deleting !== null} onClose={() => setDeleting(null)} title={`Delete the draft “${deleting?.title ?? ""}”?`}>
        <div className="grid gap-2">
          <Button variant="danger" block onClick={() => deleting && deleteDraft(deleting)}>
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
  const due = p.deadlineInDays === null ? "no deadline" : p.deadlineInDays === 0 ? "closes today" : `closes in ${p.deadlineInDays} ${p.deadlineInDays === 1 ? "day" : "days"}`;
  return `${clicks} · ${due}`;
}
