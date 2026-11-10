import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/server";
import { findResource } from "@/lib/catalog/resources";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServiceSupabase } from "@/lib/supabase/server";

/**
 * /learn/:id: opens a learning resource for a missing skill (SPEC §6).
 * For signed-in users it records when they opened it, so "I finished it"
 * can be checked later (it earns EXP only some minutes after an open).
 *
 * Security: it only redirects to the catalog URL for that id, never to a
 * destination from the request, so it can't be used as an open redirect.
 */
export async function GET(req: Request, ctx: RouteContext<"/learn/[id]">) {
  const { id } = await ctx.params;
  const resource = findResource(id);
  if (!resource) return NextResponse.redirect(new URL("/tips", req.url), 303);

  if (isSupabaseConfigured()) {
    try {
      const userId = await currentUserId();
      if (userId) {
        const { error } = await createServiceSupabase()
          .from("resource_opens")
          .upsert({ user_id: userId, resource_id: resource.id, opened_at: new Date().toISOString() }, { onConflict: "user_id,resource_id" });
        if (error) console.error("[learn] couldn't record the open:", error.message);
      }
    } catch (e) {
      // Logging is best effort; opening the resource must never fail because of it.
      console.error("[learn]", e instanceof Error ? e.message : e);
    }
  }

  const res = NextResponse.redirect(resource.url, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
