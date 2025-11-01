import type { NextApiRequest, NextApiResponse } from "next";
import { igdbRequest } from "../../../lib/igdb";

const M = 500;
const C = 82;

interface BaseGame {
  id: number;
  name: string;
  rating?: number | null;
  rating_count?: number | null;
  total_rating?: number | null;
  total_rating_count?: number | null;
  aggregated_rating?: number | null;
  aggregated_rating_count?: number | null;
  cover?: { id?: number; url?: string } | null;
  category?: number | null;
  version_parent?: number | null;
  status?: number | null;
  first_release_date?: number | null;
  platforms?: { id?: number; name?: string }[] | null;
  [key: string]: unknown;
}

function weightedRating(R: number, v: number) {
  return (v / (v + M)) * R + (M / (v + M)) * C;
}

const MIN_TOTAL = 20;
const MIN_AGG = 3;
const MIN_USER = 50;

type Basis = "total" | "agg" | "user";

function pickScore(g: BaseGame): { R: number; v: number; basis: Basis } | null {
  if (
    typeof g.total_rating === "number" &&
    (g.total_rating_count ?? 0) >= MIN_TOTAL
  ) {
    return { R: g.total_rating, v: g.total_rating_count!, basis: "total" };
  }
  if (
    typeof g.aggregated_rating === "number" &&
    (g.aggregated_rating_count ?? 0) >= MIN_AGG
  ) {
    return {
      R: g.aggregated_rating,
      v: g.aggregated_rating_count!,
      basis: "agg",
    };
  }
  if (typeof g.rating === "number" && (g.rating_count ?? 0) >= MIN_USER) {
    return { R: g.rating, v: g.rating_count!, basis: "user" };
  }
  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const now = Math.floor(Date.now() / 1000);

    // ✅ Updated: use "exists" instead of "null" for IGDB filtering.
    const queryBody = `
fields id,name,slug,first_release_date,category,status,
       total_rating,total_rating_count,
       aggregated_rating,aggregated_rating_count,
       rating,rating_count,
       cover.url,platforms.name;
where category = (0,4,8,9)
  & !exists version_parent
  & (status = 0 | !exists status)
  & first_release_date < ${now}
  & (total_rating_count > 0 | rating_count > 0 | aggregated_rating_count > 0);
sort total_rating desc;
limit 200;
`;

    // 🔍 DEBUG: print IGDB response
    const games = await igdbRequest("games", queryBody);
    console.log("IGDB returned:", Array.isArray(games) ? games.length : games);

    if (!Array.isArray(games) || games.length === 0) {
      return res.status(200).json({
        meta: {
          warning:
            "IGDB returned 0 results — check your access token or query syntax.",
          queryPreview: queryBody.slice(0, 400),
        },
        games: [],
      });
    }

    type EnrichedGame = BaseGame & { weightedRating: number; basis: Basis };

    const enriched = games
      .map((g: BaseGame) => {
        const picked = pickScore(g);
        if (!picked) return null;
        const wr = weightedRating(picked.R, picked.v);
        return {
          ...g,
          basis: picked.basis,
          weightedRating: Number(wr.toFixed(2)),
        };
      })
      .filter((g): g is EnrichedGame => g !== null)
      .sort((a, b) => b.weightedRating - a.weightedRating)
      .slice(0, 100);

    return res.status(200).json({
      meta: {
        formula: "WR = (v/(v+m))*R + (m/(v+m))*C",
        C,
        m: M,
        filter: "(total_rating_count>=20 or rating_count>=50)",
        sort: "weightedRating desc (computed)",
        total: enriched.length,
        rawFetched: games.length,
      },
      games: enriched,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
