import type { NextApiRequest, NextApiResponse } from "next";

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

    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Missing search query" });

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

    // Query IGDB
    const igdbRes = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: {
            "Client-ID": process.env.TWITCH_CLIENT_ID!,
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
            "Content-Type": "text/plain",
        },
        body: `search "${q}"; fields name,summary,rating,cover.url; limit 500;`,
    });

    const data = await igdbRes.json();
    res.status(200).json(data);
}
