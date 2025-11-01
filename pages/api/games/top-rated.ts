import type { NextApiRequest, NextApiResponse } from "next";
import { igdbRequest } from "../../../lib/igdb";

// Weighted rating configuration (given constants)
const M = 500; // m = minimum votes required
const C = 82; // C = average rating across all qualifying games (provided)

interface BaseGame {
  id: number;
  name: string;
  rating?: number;
  rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  cover?: { id?: number; url?: string };
  [key: string]: unknown;
}

// Compute weighted rating: WR = (v / (v + m)) * R + (m / (v + m)) * C
function weightedRating(R: number, v: number) {
  return (v / (v + M)) * R + (M / (v + M)) * C;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const queryBody = [
      "fields id,name,slug,first_release_date,category,version_parent,status,total_rating,total_rating_count,aggregated_rating,aggregated_rating_count,rating,rating_count,cover.url,platforms.name,franchises;",
      "where category = (0,4) & version_parent = null & status = 0 & first_release_date != null & (total_rating_count >= 200 | aggregated_rating_count >= 200 | rating_count >= 1000) & (total_rating >= 80 | aggregated_rating >= 80 | rating >= 85);",
      "limit 500;", // no sort here; you’ll sort by WR locally
    ].join("\n");

    const games = await igdbRequest("games", queryBody);

    type EnrichedGame = BaseGame & {
      wr: number;
      basis: "total" | "agg" | "user";
    };

    const enriched = (games as BaseGame[])
      .map((g) => {
        // choose the best available score source
        if (
          typeof g.total_rating === "number" &&
          typeof g.total_rating_count === "number"
        ) {
          return {
            ...g,
            wr: weightedRating(g.total_rating, g.total_rating_count),
            basis: "total" as const,
          };
        }
        if (
          typeof g.aggregated_rating === "number" &&
          typeof g.aggregated_rating_count === "number"
        ) {
          return {
            ...g,
            wr: weightedRating(g.aggregated_rating, g.aggregated_rating_count),
            basis: "agg" as const,
          };
        }
        if (
          typeof g.rating === "number" &&
          typeof g.rating_count === "number"
        ) {
          return {
            ...g,
            wr: weightedRating(g.rating, g.rating_count),
            basis: "user" as const,
          };
        }
        return null;
      })
      .filter((x): x is EnrichedGame => !!x)
      .sort((a, b) => b.wr - a.wr)
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
