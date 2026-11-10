import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/company/RegisterForm";
import { BusinessHeader, HEADER_LINK } from "@/components/layout/BusinessHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata: Metadata = { title: "Register your company" };

export default function CompanyRegisterPage() {
  return (
    <>
      <BusinessHeader area="for companies" home="/companies">
        <Link href="/companies/login" className={HEADER_LINK}>
          Log in
        </Link>
      </BusinessHeader>
      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-gutter pb-16 pt-8">
        <RegisterForm />
      </main>
      <SiteFooter />
    </>
  );
}
