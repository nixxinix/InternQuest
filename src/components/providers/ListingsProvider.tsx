"use client";

import { createContext, use, useContext, useMemo, type ReactNode } from "react";
import type { Listing } from "@/lib/listings/listing";
import { SAMPLE_LISTINGS } from "@/lib/sample/listings";
import { LIVE } from "./AccountProvider";

const ListingsContext = createContext<Promise<Listing[]> | null>(null);

/** Hands the open listings to client screens (see ListingsScope). */
export function ListingsProvider({ listings, children }: { listings: Promise<Listing[]>; children: ReactNode }) {
  return <ListingsContext.Provider value={listings}>{children}</ListingsContext.Provider>;
}

/** Open listings. Suspends until loaded, so call it inside a <Suspense> boundary. */
export function useListings(): Listing[] {
  const promise = useContext(ListingsContext);
  if (!promise) {
    // With a real database, a screen outside ListingsScope would quietly show the samples.
    if (LIVE) throw new Error("useListings() needs <ListingsScope> around the page.");
    return SAMPLE_LISTINGS;
  }
  return use(promise);
}

/** Look up an open listing by id (null for unknown or closed ones). */
export function useFindListing(): (id: string) => Listing | null {
  const listings = useListings();
  return useMemo(() => {
    const byId = new Map(listings.map((l) => [l.id, l]));
    return (id: string) => byId.get(id) ?? null;
  }, [listings]);
}
