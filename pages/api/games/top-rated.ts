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
        // IGDB base filter equivalent to: $filter=rating_count>=200 and rating>=75
        const queryBody = [
            "fields id,name,rating,rating_count,cover.url;",
            "where rating != null & rating_count != null & rating_count >= 200 & rating >= 75;",
            "limit 500;",
        ].join("\n");

        const games = await igdbRequest("games", queryBody);

        const enriched = (games as BaseGame[])
            .filter(
                (g) =>
                    typeof g.rating === "number" &&
                    typeof g.rating_count === "number"
            )
            .map((g) => {
                const rating = g.rating as number; // filtered above ensures number
                const votes = g.rating_count as number;
                const wr = weightedRating(rating, votes);
                return { ...g, weightedRating: Number(wr.toFixed(2)) };
            })
            .sort((a, b) => b.weightedRating - a.weightedRating);

        return res.status(200).json({
            meta: {
                formula: "WR = (v/(v+m))*R + (m/(v+m))*C",
                C,
                m: M,
                filter: "rating_count>=200 and rating>=75",
                total: enriched.length,
            },
            games: enriched,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(500).json({ error: message });
    }
}
