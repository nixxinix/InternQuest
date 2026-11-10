import { NextResponse } from "next/server";
import { logApplyClick } from "@/lib/listings/clicks";
import { isClosed } from "@/lib/listings/listing";
import { getListing } from "@/lib/listings/server";

/**
 * /go/:id: logs an Apply click, then sends the user to the original posting
 * (SPEC §5.5). The click time is what "Yes, I applied" is checked against.
 *
 * Security: it only ever redirects to the URL stored for that listing. It
 * never takes a destination from the request, so it can't be used as an
 * open redirect. No IP address is stored.
 */
export async function GET(req: Request, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params;
  const listing = await getListing(id);

  if (!listing || isClosed(listing) || listing.apply.kind !== "link") {
    // Closed or unknown: the listing page explains. Email listings are applied to from that page.
    return NextResponse.redirect(new URL(`/listings/${encodeURIComponent(id)}`, req.url), 303);
  }

  await logApplyClick(listing, "link");

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
  const listing = await getListing(id);
  if (!listing || isClosed(listing)) return new NextResponse(null, { status: 404 });
  await logApplyClick(listing, listing.apply.kind === "email" ? "email" : "link");
  return new NextResponse(null, { status: 204 });
}
