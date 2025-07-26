import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing game ID" });

    // Get Twitch token
    const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.TWITCH_CLIENT_ID!,
            client_secret: process.env.TWITCH_CLIENT_SECRET!,
            grant_type: "client_credentials",
        }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Query IGDB for game by ID
    const igdbRes = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: {
            "Client-ID": process.env.TWITCH_CLIENT_ID!,
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
            "Content-Type": "text/plain",
        },
        body: `where id = ${id}; fields name,summary,rating,cover.url; limit 1;`,
    });

    const data = await igdbRes.json();
    res.status(200).json(data[0] || null);
}
