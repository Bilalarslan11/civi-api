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
function weightedRating(rating: number, votes: number): number {
    const v = votes;
    const m = M;
    return (v / (v + m)) * rating + (m / (v + m)) * C;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        // Enhanced IGDB filter using either total_* metrics OR user rating metrics.
        // Provided filter intent:
        // fields name, total_rating, total_rating_count, rating, rating_count;
        // where (total_rating_count >= 100 | rating_count >= 100) & (total_rating >= 85 | rating >= 85);
        // sort total_rating desc; limit 100;
        const queryBody = [
            "fields id,name,total_rating,total_rating_count,rating,rating_count,cover.url;",
            "where (total_rating_count != null | rating_count != null) & (total_rating != null | rating != null) & (total_rating_count >= 100 | rating_count >= 100) & (total_rating >= 85 | rating >= 85);",
            "sort total_rating desc;",
            "limit 100;",
        ].join("\n");

        const games = await igdbRequest("games", queryBody);

        type EnrichedGame = BaseGame & {
            weightedRating: number;
            usedRating: "total_rating" | "rating";
        };
        const enriched: EnrichedGame[] = (games as BaseGame[])
            .map((g): EnrichedGame | null => {
                const hasTotal =
                    typeof g.total_rating === "number" &&
                    typeof g.total_rating_count === "number";
                const R = hasTotal ? g.total_rating : g.rating;
                const v = hasTotal ? g.total_rating_count : g.rating_count;
                if (typeof R !== "number" || typeof v !== "number") return null;
                const wr = weightedRating(R, v);
                return {
                    ...g,
                    usedRating: hasTotal ? "total_rating" : "rating",
                    weightedRating: Number(wr.toFixed(2)),
                };
            })
            .filter((g): g is EnrichedGame => g !== null)
            .sort((a, b) => b.weightedRating - a.weightedRating);

        return res.status(200).json({
            meta: {
                formula: "WR = (v/(v+m))*R + (m/(v+m))*C",
                C,
                m: M,
                filter: "(total_rating_count>=100 or rating_count>=100) and (total_rating>=85 or rating>=85)",
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
