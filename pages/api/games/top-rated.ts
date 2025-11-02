import type { NextApiRequest, NextApiResponse } from "next";
import { igdbRequest } from "../../../lib/igdb";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const queryBody = `
      fields id,name;
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
