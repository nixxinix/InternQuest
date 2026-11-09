import { NextResponse } from "next/server";
import { isClosed } from "@/lib/listings/listing";
import { getListing } from "@/lib/listings/server";

/**
 * /go/:id: logs an Apply click, then sends the user to the original posting
 * (SPEC §5.5).
 *
 * Security: it only ever redirects to the URL stored for that listing. It
 * never takes a destination from the request, so it can't be used as an
 * open redirect.
 *
 * TODO(Phase 2): insert into click_logs (listing_id, user_id or null,
 * created_at). For logged-out visitors store no IP address (USER_FLOWS risk
 * flags). The server-side click time is what the apply-confirm check uses.
 */
export async function GET(_req: Request, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params;
  const listing = await getListing(id);

  if (!listing || isClosed(listing)) {
    return NextResponse.redirect(new URL(`/listings/${encodeURIComponent(id)}`, _req.url), 303);
  }
  if (listing.apply.kind !== "link") {
    // Email listings are applied to from the listing page (the email sheet).
    return NextResponse.redirect(new URL(`/listings/${encodeURIComponent(id)}`, _req.url), 303);
  }

  const res = NextResponse.redirect(listing.apply.url, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

/**
 * POST /go/:id: click log without a redirect, used when the visitor opens
 * their email app to apply. Sent with navigator.sendBeacon.
 */
export async function POST(_req: Request, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params;
  if (!(await getListing(id))) return new NextResponse(null, { status: 404 });
  // TODO(Phase 2): insert into click_logs, same as GET.
  return new NextResponse(null, { status: 204 });
}
