import type { ReactNode } from "react";
import { getOpenListings } from "@/lib/listings/server";
import { ListingsProvider } from "./ListingsProvider";

/** Server wrapper: starts loading the open listings; client screens read them with useListings(). */
export function ListingsScope({ children }: { children: ReactNode }) {
  return <ListingsProvider listings={getOpenListings()}>{children}</ListingsProvider>;
}
