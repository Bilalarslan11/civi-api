import type { NextApiRequest, NextApiResponse } from "next";
import { igdbRequest } from "../../../lib/igdb";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://zehai.dk",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle OPTIONS preflight request
  if (req.method === "OPTIONS") {
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Set CORS headers for all responses
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    const queryBody = `
      fields id,name,
       total_rating,total_rating_count,
       rating,rating_count,
       aggregated_rating,aggregated_rating_count,
       cover.url,platforms.name;
      where total_rating != null
        & rating_count >= 100;
      sort total_rating desc;
      limit 100;
      `;

    const games = await igdbRequest("games", queryBody);

    if (!Array.isArray(games) || games.length === 0) {
      return res.status(200).json({ games: [] });
    }

    return res.status(200).json({ games });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
