// Cache observability (ADMIN only).
// GET — returns stats (size/hits/misses/hit-ratio).
// POST ?action=clear — flushes the entire cache (emergency tool).
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { cacheStore, cacheEnabled } from "@/lib/cache";
import { MSG } from "@/lib/messages";

export async function GET() {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "GET", "ADMIN", null)) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const s = cacheStore.stats();
  const totalReads = s.hits + s.misses;
  const hitRatio = totalReads === 0 ? 0 : s.hits / totalReads;

  return Response.json(
    apiResponse(true, {
      enabled: cacheEnabled,
      driver: process.env.CACHE_DRIVER ?? "lru",
      size: s.size,
      hits: s.hits,
      misses: s.misses,
      hitRatio: Number(hitRatio.toFixed(4)),
      tagCount: s.tagCount,
    })
  );
}

export async function POST(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "DELETE", "ADMIN", null)) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("action") !== "clear") {
    return Response.json(apiResponse(false, undefined, "Unknown action"), { status: 400 });
  }

  cacheStore.clear();
  return Response.json(apiResponse(true, { cleared: true }));
}
