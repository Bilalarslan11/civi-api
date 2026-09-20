import type { NextApiRequest, NextApiResponse } from "next";
import {
    deleteGameStatus,
    getGameStatuses,
    saveGameStatus,
    type GameStatus,
    type GameStatusEntry,
} from "../../../lib/gameStatuses";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "https://zehai.dk",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

function setCorsHeaders(res: NextApiResponse) {
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        res.setHeader(key, value);
    });
}

function isGameStatus(value: unknown): value is GameStatus {
    return value === "Playing" || value === "Completed" || value === "Quit";
}

function parseEntry(body: unknown): GameStatusEntry | null {
    if (!body || typeof body !== "object") return null;
    const value = body as Record<string, unknown>;
    const id = Number(value.id);
    const name = value.name;
    if (!Number.isInteger(id) || id <= 0 || typeof name !== "string") return null;
    if (!isGameStatus(value.status)) return null;
    return { id, status: value.status, name: name.slice(0, 400) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") return res.status(204).end();

    try {
        if (req.method === "GET") {
            return res.status(200).json(await getGameStatuses());
        }

        if (req.method === "PUT") {
            const entry = parseEntry(req.body);
            if (!entry) return res.status(400).json({ error: "Invalid status entry" });
            await saveGameStatus(entry);
            return res.status(204).end();
        }

        if (req.method === "DELETE") {
            const gameId = Number(req.query.id);
            if (!Number.isInteger(gameId) || gameId <= 0) {
                return res.status(400).json({ error: "Invalid game id" });
            }
            await deleteGameStatus(gameId);
            return res.status(204).end();
        }

        res.setHeader("Allow", "GET, PUT, DELETE, OPTIONS");
        return res.status(405).json({ error: "Method not allowed" });
    } catch (error) {
        console.error("Game status API error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}