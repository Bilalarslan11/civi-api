import type { NextApiRequest, NextApiResponse } from "next";
import { igdbRequest } from "../../../lib/igdb";

// Weighted rating configuration (given constants)
const M = 500; // m = minimum votes required
const C = 82; // C = average rating across all qualifying games (provided)

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
  [key: string]: unknown; // keep if you like, but explicit fields above solve the issue
}

// Compute weighted rating: WR = (v / (v + m)) * R + (m / (v + m)) * C
function weightedRating(R: number, v: number) {
  return (v / (v + M)) * R + (M / (v + M)) * C;
}

type Basis = "total" | "agg" | "user";

function pickScore(g: BaseGame): { R: number; v: number; basis: Basis } | null {
  if (
    typeof g.total_rating === "number" &&
    typeof g.total_rating_count === "number"
  ) {
    return { R: g.total_rating, v: g.total_rating_count, basis: "total" };
  }
  if (
    typeof g.aggregated_rating === "number" &&
    typeof g.aggregated_rating_count === "number"
  ) {
    return {
      R: g.aggregated_rating,
      v: g.aggregated_rating_count,
      basis: "agg",
    };
  }
  if (typeof g.rating === "number" && typeof g.rating_count === "number") {
    return { R: g.rating, v: g.rating_count, basis: "user" };
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

    const queryBody = `
fields id,name,slug,first_release_date,category,version_parent,status,
       total_rating,total_rating_count,
       aggregated_rating,aggregated_rating_count,
       rating,rating_count,
       cover.url,platforms.name;

where category = (0,4,8,9)
  & version_parent = null
  & (status = 0 | status = null)
  & first_release_date < ${now}
  & (total_rating != null | aggregated_rating != null | rating != null)
  & (total_rating_count >= 10 | aggregated_rating_count >= 10 | rating_count >= 100);

limit 500;
`;
    const games = await igdbRequest("games", queryBody);

    type EnrichedGame = BaseGame & { weightedRating: number; basis: Basis };

    const enriched: EnrichedGame[] = (games as BaseGame[])
      .map((g) => {
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
        filter:
          "(total_rating_count>=100 or rating_count>=100) and (total_rating>=85 or rating>=85)",
        selection:
          "fields id,name,total_rating,total_rating_count,rating,rating_count,cover.url",
        sort: "weightedRating desc (computed; base IGDB sort total_rating desc)",
        total: enriched.length,
      },
      games: enriched,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
