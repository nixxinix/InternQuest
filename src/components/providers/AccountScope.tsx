import type { ReactNode } from "react";
import { getAccount } from "@/lib/account/server";
import { AccountProvider } from "./AccountProvider";

/**
 * Server wrapper for pages that show the signed-in user. Starts loading the
 * account without waiting for it; client screens read it with useAccount()
 * inside their own <Suspense>, so the rest of the page isn't held up.
 */
export function AccountScope({ children }: { children: ReactNode }) {
  return <AccountProvider account={getAccount()}>{children}</AccountProvider>;
}
