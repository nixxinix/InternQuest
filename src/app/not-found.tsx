import { PublicHeader } from "@/components/layout/PublicHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

export default function NotFound() {
  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-gutter py-section">
        <EmptyState
          title="We couldn't find that page"
          body="The link may be old, or this part of InternQuest isn't ready yet."
          action={<ButtonLink href="/">Back to listings</ButtonLink>}
        />
      </main>
      <SiteFooter />
    </>
  );
}
