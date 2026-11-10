import { NextResponse } from "next/server";
import { confirmCompanyEmail } from "@/app/actions/company";

/**
 * The link from the company confirmation email. Always lands on the
 * dashboard (signing in first if needed); the query flag is just for the
 * one-time toast.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const ok = await confirmCompanyEmail(token);
  return NextResponse.redirect(new URL(`/companies/dashboard?confirmed=${ok ? "1" : "0"}`, req.url));
}
