"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { decideQueueItem, markCompanyEmailConfirmed, recheckWebsite } from "@/app/actions/admin";
import { logOut } from "@/app/actions/auth";
import { BusinessHeader, HEADER_LINK } from "@/components/layout/BusinessHeader";
import { Button } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Sheet } from "@/components/ui/Sheet";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  ACTIONS,
  REPORT_REASON_LABEL,
  isAutoHidden,
  reportCount,
  subjectOf,
  type AuditEntry,
  type QueueItem,
  type QueueKind,
} from "@/lib/admin/queue";
import { domainMatchesWebsite, websiteHost } from "@/lib/company/email";
import { useMediaQuery, DESKTOP_QUERY } from "@/lib/browser/useMediaQuery";

const TABS: { kind: QueueKind; label: string }[] = [
  { kind: "company", label: "Companies" },
  { kind: "report", label: "Reports" },
  { kind: "flag", label: "Flagged" },
];

/**
 * W14 admin queue (USER_FLOWS §8). One screen, one decision. No game elements.
 * This route sits behind an admin role check (src/lib/admin/server.ts); every
 * decision is a server action that re-validates the real row and writes to
 * admin_audit.
 */
export function AdminQueue({
  initialItems,
  initialAudit,
  adminLabel,
}: {
  initialItems: QueueItem[];
  initialAudit: AuditEntry[];
  adminLabel: string;
}) {
  return (
    <ToastProvider>
      <Queue initialItems={initialItems} initialAudit={initialAudit} adminLabel={adminLabel} />
    </ToastProvider>
  );
}

function Queue({ initialItems, initialAudit, adminLabel }: { initialItems: QueueItem[]; initialAudit: AuditEntry[]; adminLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [queue, setQueue] = useState<QueueItem[]>(initialItems);
  const [audit, setAudit] = useState<AuditEntry[]>(initialAudit);
  const [auditOpen, setAuditOpen] = useState(false);
  const detailHeading = useRef<HTMLHeadingElement>(null);

  const tabParam = params.get("tab");
  const kind: QueueKind = tabParam === "report" || tabParam === "flag" ? tabParam : "company";
  const items = queue.filter((q) => q.kind === kind);
  const itemParam = params.get("item");
  // Desktop always shows a decision (the first item by default); phones show the list until one is opened.
  const open = items.find((q) => q.id === itemParam) ?? (isDesktop ? (items[0] ?? null) : null);

  const go = (next: { tab?: QueueKind; item?: string | null }, how: "push" | "replace" = "replace") => {
    const q = new URLSearchParams(window.location.search);
    if (next.tab) q.set("tab", next.tab);
    if (next.item === null) q.delete("item");
    else if (next.item) q.set("item", next.item);
    const url = q.toString() ? `${pathname}?${q}` : pathname;
    if (how === "push") router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  };

  // Moving to an item puts keyboard and screen reader focus on its heading.
  useEffect(() => {
    if (open && itemParam) detailHeading.current?.focus({ preventScroll: !isDesktop });
  }, [open, itemParam, isDesktop]);

  const onDecide = async (item: QueueItem, actionId: string, reason: string) => {
    const index = items.findIndex((q) => q.id === item.id);
    const res = await decideQueueItem(item.kind, item.id, actionId, reason).catch(() => ({ ok: false as const, error: "Couldn't reach InternQuest. Check your connection and try again." }));
    if (!res.ok) {
      toast({ tone: "error", message: res.error });
      return;
    }
    const action = ACTIONS[item.kind].find((a) => a.id === actionId);
    const nextQueue = queue.filter((q) => q.id !== item.id);
    setQueue(nextQueue);
    setAudit((a) => [{ at: new Date().toISOString(), admin: adminLabel, kind: item.kind, itemId: item.id, subject: subjectOf(item), action: action?.label ?? actionId, reason }, ...a]);
    toast({ tone: "success", message: `${action?.label ?? "Done"}: ${subjectOf(item)}. Logged with your reason.` });
    const sameKind = nextQueue.filter((q) => q.kind === item.kind);
    const next = sameKind[Math.min(index, sameKind.length - 1)] ?? null;
    go({ item: next?.id ?? null });
  };

  const onRecheck = async (companyId: string) => {
    const res = await recheckWebsite(companyId).catch(() => ({ ok: false as const, error: "Couldn't reach InternQuest." }));
    if (!res.ok) {
      toast({ tone: "error", message: res.error });
      return;
    }
    setQueue((q) => q.map((it) => (it.kind === "company" && it.id === companyId ? { ...it, websiteLoads: res.loads } : it)));
    toast({ message: res.loads ? "The website loaded." : "The website still didn't load." });
  };

  const onConfirmEmail = async (item: QueueItem) => {
    const res = await markCompanyEmailConfirmed(item.id).catch(() => ({ ok: false as const, error: "Couldn't reach InternQuest." }));
    if (!res.ok) {
      toast({ tone: "error", message: res.error });
      return;
    }
    setQueue((q) => q.map((it) => (it.kind === "company" && it.id === item.id ? { ...it, emailConfirmed: true } : it)));
    setAudit((a) => [
      { at: new Date().toISOString(), admin: adminLabel, kind: "company", itemId: item.id, subject: subjectOf(item), action: "Marked email confirmed", reason: "Checked by hand" },
      ...a,
    ]);
    toast({ tone: "success", message: "Email marked as confirmed. Logged." });
  };

  const list = (
    <nav aria-label={`${TABS.find((t) => t.kind === kind)?.label} to review`}>
      {items.length === 0 ? (
        <div className="border border-line bg-screen p-6 text-center">
          <PixelIcon name="check" scale={4} className="mx-auto text-green" />
          <p className="mt-2 text-lg font-semibold">All caught up.</p>
          <p className="text-sm text-muted">Nothing to review here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line border border-line bg-screen">
          {items.map((it) => {
            const current = open?.id === it.id;
            return (
              <li key={it.id}>
                <Link
                  href={`${pathname}?tab=${kind}&item=${it.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    go({ item: it.id }, isDesktop ? "replace" : "push");
                  }}
                  aria-current={current ? "true" : undefined}
                  className={cn("flex min-h-tap items-start justify-between gap-3 border-l-4 px-3 py-3", current ? "border-green bg-green-tint" : "border-transparent hover:bg-canvas")}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{subjectOf(it)}</span>
                    <span className="block text-sm text-muted">{listLine(it)}</span>
                  </span>
                  <span className="flex-none text-sm text-muted">{ago(it.submittedHoursAgo)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );

  return (
    <>
      <BusinessHeader area="admin" home="/admin">
        <button type="button" onClick={() => setAuditOpen(true)} className={HEADER_LINK} aria-haspopup="dialog">
          Audit log{audit.length ? ` (${audit.length})` : ""}
        </button>
        <Link href="/admin/import" className={HEADER_LINK}>
          Import listings
        </Link>
        <form action={logOut}>
          <button type="submit" className={HEADER_LINK}>
            Log out
          </button>
        </form>
      </BusinessHeader>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-gutter pb-16 pt-4 lg:pt-6">
        {/* Phone: an open item replaces the list, with a back link. */}
        {!isDesktop && open ? (
          <>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex min-h-tap items-center gap-1.5 font-semibold text-green underline-offset-4 hover:underline"
            >
              <PixelIcon name="chevronRight" scale={2} className="rotate-180" />
              Back to the list
            </button>
            <Detail key={open.id} item={open} onDecide={onDecide} onRecheck={onRecheck} onConfirmEmail={onConfirmEmail} headingRef={detailHeading} />
</>
        ) : (
          <>
            <nav aria-label="Queues" className="flex border-b-2 border-bezel">
              {TABS.map((t) => {
                const n = queue.filter((q) => q.kind === t.kind).length;
                const selected = t.kind === kind;
                return (
                  <button
                    key={t.kind}
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => go({ tab: t.kind, item: null })}
                    className={cn(
                      "inline-flex min-h-tap flex-1 items-center justify-center gap-2 px-3 text-base font-semibold sm:flex-none",
                      selected ? "bg-bezel text-screen" : "bg-screen text-ink hover:bg-line",
                    )}
                  >
                    {t.label}
                    <span className={cn("min-w-6 px-1 text-center text-sm", selected ? "bg-screen text-ink" : "bg-canvas")}>{n}</span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-4 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-8">
              {list}
              {isDesktop && open && (
                <Detail key={open.id} item={open} onDecide={onDecide} onRecheck={onRecheck} onConfirmEmail={onConfirmEmail} headingRef={detailHeading} />
              )}
            </div>
          </>
        )}
      </main>

      <Sheet open={auditOpen} onClose={() => setAuditOpen(false)} title="Audit log" description="Every decision, with who made it and why.">
        {audit.length === 0 ? (
          <p className="text-base text-muted">No decisions yet.</p>
        ) : (
          <ol className="max-h-[60dvh] divide-y divide-line overflow-y-auto">
            {audit.map((a) => (
              <li key={a.at + a.itemId} className="py-2">
                <p className="font-semibold">
                  {a.action}: {a.subject}
                </p>
                <p className="text-sm text-muted">
                  {a.reason} · by {a.admin} ·{" "}
                  {new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(new Date(a.at))}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------------------ */

function ago(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const d = Math.floor(hours / 24);
  return `${d}d ago`;
}

function listLine(it: QueueItem): string {
  if (it.kind === "company") return websiteHost(it.website) ?? it.website;
  if (it.kind === "report") return `${reportCount(it)} ${reportCount(it) === 1 ? "report" : "reports"}${isAutoHidden(it) ? " · hidden automatically" : ""}`;
  return it.pattern;
}

function Detail({
  item,
  onDecide,
  onRecheck,
  onConfirmEmail,
  headingRef,
}: {
  item: QueueItem;
  onDecide: (item: QueueItem, actionId: string, reason: string) => Promise<void>;
  onRecheck: (companyId: string) => Promise<void>;
  onConfirmEmail: (item: QueueItem) => Promise<void>;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  const [rechecking, setRechecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <section aria-labelledby="detail-h" className="mt-4 border border-line bg-screen p-5 lg:mt-0">
      <h2 id="detail-h" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
        {subjectOf(item)}
      </h2>

      {item.kind === "company" && (
        <>
          <p className="mt-1 break-words text-base text-muted">
            {item.email} · {item.website} · {item.role}
          </p>
          <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Checks</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            <Check ok={item.emailConfirmed} yes="Email confirmed" no="Email not confirmed yet" />
            <Check ok={domainMatchesWebsite(item.email, item.website)} yes="Email domain matches the website" no="Email domain doesn't match the website" />
            <Check ok={item.websiteLoads} yes="Website loads" no="Website didn't load" />
            <Check ok={item.registrationNo !== null} yes={`DTI/SEC: ${item.registrationNo}`} no="No DTI/SEC number given" neutral />
          </ul>
          <Button
            variant="ghost"
            className="mt-2"
            loading={rechecking}
            onClick={async () => {
              setRechecking(true);
              await onRecheck(item.id);
              setRechecking(false);
            }}
          >
            Recheck website
          </Button>
          {!item.emailConfirmed && (
            <Button
              variant="ghost"
              className="mt-2"
              loading={confirming}
              onClick={async () => {
                setConfirming(true);
                await onConfirmEmail(item);
                setConfirming(false);
              }}
            >
              I checked the email another way
            </Button>
          )}
          <p className="mt-4 text-base">
            Draft listings waiting: <span className="font-semibold">{item.draftListings}</span>
          </p>
        </>
      )}

      {item.kind === "report" && (
        <>
          {isAutoHidden(item) && (
            <p className="mt-2 border-l-4 border-alert bg-alert-tint p-3 text-base font-semibold">
              Hidden automatically: 3 or more reports say it asks for payment.
            </p>
          )}
          <div className="mt-4 border border-line bg-canvas p-4">
            <p className="text-sm text-muted">The listing</p>
            <p className="font-semibold">{item.listingTitle}</p>
            <p className="text-base">{item.company}</p>
            <p className="mt-2 text-base">{item.snippet}</p>
          </div>
          <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Reports ({reportCount(item)})</h3>
          <ul className="mt-2 space-y-1">
            {item.reasons.map((r) => (
              <li key={r.reason} className="text-base">
                {REPORT_REASON_LABEL[r.reason]}: <span className="font-semibold">{r.count}</span>
              </li>
            ))}
          </ul>
          {item.notes.length > 0 && (
            <ul className="mt-3 space-y-2">
              {item.notes.map((n) => (
                <li key={n} className="border-l-2 border-line pl-3 text-base italic">
                  &ldquo;{n}&rdquo;
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-muted">Reporters are never shown here or to the company.</p>
        </>
      )}

      {item.kind === "flag" && (
        <>
          <p className="mt-2 text-lg font-semibold">{item.pattern}</p>
          <p className="mt-1 text-base">{item.detail}</p>
          <p className="mt-3 text-base">
            EXP from these: <span className="font-semibold">{item.expAtStake}</span>
          </p>
          <p className="mt-1 text-sm text-muted">Nothing has been taken away yet. Flags only ask for a look.</p>
        </>
      )}

      <Decision item={item} onDecide={onDecide} />
    </section>
  );
}

function Check({ ok, yes, no, neutral }: { ok: boolean; yes: string; no: string; neutral?: boolean }) {
  return (
    <li className="flex items-start gap-2 text-base">
      {ok ? (
        <PixelIcon name="check" scale={2} className="mt-1 text-green" />
      ) : neutral ? (
        <span aria-hidden="true" className="mt-0.5 w-4 flex-none text-center font-semibold text-muted">
          –
        </span>
      ) : (
        <PixelIcon name="close" scale={2} className="mt-1 text-alert" />
      )}
      <span className={ok ? undefined : neutral ? "text-muted" : "font-semibold"}>
        <span className="sr-only">{ok ? "Passed: " : neutral ? "Not given: " : "Failed: "}</span>
        {ok ? yes : no}
      </span>
    </li>
  );
}

/** Pick an action, pick a reason, confirm. Two taps plus a confirm, always with a reason. */
function Decision({ item, onDecide }: { item: QueueItem; onDecide: (item: QueueItem, actionId: string, reason: string) => Promise<void> }) {
  const actions = ACTIONS[item.kind];
  const [actionId, setActionId] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const action = actions.find((a) => a.id === actionId) ?? null;

  return (
    <div className="mt-6 border-t-2 border-bezel pt-4">
      <h3 className="font-semibold">Decision</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.id}
            variant={actionId === a.id ? (a.tone === "danger" ? "danger" : "primary") : "secondary"}
            aria-pressed={actionId === a.id}
            onClick={() => {
              setActionId(a.id);
              setReason(a.reasons.length === 1 ? a.reasons[0] : null);
            }}
          >
            {a.label}
          </Button>
        ))}
      </div>
      {action && (
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Reason (saved in the audit log{item.kind === "company" && action.id === "reject" ? " and shown to the company" : ""})</legend>
          <div className="mt-1 grid gap-1">
            {action.reasons.map((r) => (
              <label key={r} className="flex min-h-tap cursor-pointer items-center gap-3 border-b border-line py-1">
                <input type="radio" name={`reason-${item.id}`} checked={reason === r} onChange={() => setReason(r)} className="size-5 accent-green" />
                <span className="text-base">{r}</span>
              </label>
            ))}
          </div>
          <Button
            className="mt-3"
            variant={action.tone === "danger" ? "danger" : "primary"}
            disabled={!reason}
            loading={busy}
            onClick={async () => {
              if (!reason) return;
              setBusy(true);
              await onDecide(item, action.id, reason);
              setBusy(false);
            }}
          >
            {action.label}: {subjectOf(item)}
          </Button>
        </fieldset>
      )}
      <p className="mt-3 text-sm text-muted">Every action is logged with your reason.</p>
    </div>
  );
}
