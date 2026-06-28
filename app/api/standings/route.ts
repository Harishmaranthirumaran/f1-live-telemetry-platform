import { type NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../../lib/rateLimit";
import { getChampionshipStandings } from "../../../lib/standings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const url = new URL(request.url);
  const season = url.searchParams.get("season") ?? "current";
  const force = url.searchParams.get("refresh") === "1";

  try {
    const payload = await getChampionshipStandings(season, { force });
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Standings fetch failed";
    return NextResponse.json(
      {
        error: message,
        drivers: [],
        constructors: [],
        season,
        round: "0",
        fetchedAt: new Date().toISOString(),
        warnings: [message],
      },
      { status: 502 }
    );
  }
}
