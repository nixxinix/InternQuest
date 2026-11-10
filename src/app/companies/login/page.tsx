import type { Metadata } from "next";
import Link from "next/link";
import { CompanyLoginForm } from "@/components/company/CompanyLoginForm";
import { BusinessHeader, HEADER_LINK } from "@/components/layout/BusinessHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata: Metadata = { title: "Company log in", robots: { index: false, follow: false } };

export default function CompanyLoginPage() {
  return (
    <>
      <BusinessHeader area="for companies" home="/companies">
        <Link href="/companies/register" className={HEADER_LINK}>
          Register
        </Link>
      </BusinessHeader>
      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-gutter pb-16 pt-8">
        <CompanyLoginForm />
      </main>
      <SiteFooter />
    </>
  );
}
