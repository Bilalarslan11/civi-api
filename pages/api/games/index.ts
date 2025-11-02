import type { NextApiRequest, NextApiResponse } from "next";
import { igdbRequest } from "../../../lib/igdb";

// OData-like query mapping to IGDB Apicalypse for /v4/games
// Supported:
// - $select: comma-separated fields list (e.g. $select=id,name,summary)
// - $filter: IGDB where-clause snippet (e.g. $filter=rating>=90 & rating_count>=100)
//   Convenience: accepts lowercase logical words 'and' / 'or' which are converted to '&' / '|' automatically.
// - $search: text search (e.g. $search=zelda)
// - $sort: field [asc|desc] (e.g. $sort=rating desc)
// - $limit: 1..500
// - $offset: >= 0
// Notes:
// - We do minimal validation and escape search.

function coerceLimit(v: unknown, def = 20) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.min(Math.max(1, n), 500);
    return def;
}

function coerceOffset(v: unknown, def = 0) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
    return def;
}

function sanitizeSort(v: string | string[] | undefined): string | undefined {
    if (!v) return undefined;
    const s = Array.isArray(v) ? v[0] : v;
    // allow patterns like "rating desc" or "name asc"
    const m = /^([a-zA-Z0-9_.]+)(?:\s+(asc|desc))?$/.exec(s.trim());
    if (!m) return undefined;
    const dir = m[2] ? m[2].toLowerCase() : "asc";
    return `${m[1]} ${dir}`;
}

function parseSelect(q: string | string[] | undefined): string | undefined {
    if (!q) return undefined;
    const s = Array.isArray(q) ? q[0] : q;
    return s
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean)
        .join(",");
}

function escapeSearch(s: string) {
    // Escape double quotes in search, IGDB uses: search "...";
    return s.replace(/"/g, '\\"');
}

function normalizeFilter(raw: string): string {
    // Replace standalone logical words (case-insensitive) with IGDB operators.
    // We avoid touching inside quoted strings (simple approach: split by quotes and only transform even segments)
    const parts = raw.split(/("[^"]*"|'[^']*')/); // keep quotes in result
    return parts
        .map((segment) => {
            // If segment starts with a quote, leave unchanged
            if (segment.startsWith('"') || segment.startsWith("'"))
                return segment;
            // Only transform non-quoted segments
            return segment
                .replace(/\band\b/gi, "&")
                .replace(/\bor\b/gi, "|")
                .replace(/\s+/g, " ") // collapse extra whitespace
                .trim();
        })
        .join(" ") // re-join with single spaces between segments
        .replace(/\s+([&|])\s+/g, " $1 ") // ensure spacing around operators
        .trim();
}

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
        const { $select, $filter, $search, $sort, $limit, $offset } =
            req.query as Record<string, string>;

        const fields =
            parseSelect($select) ?? "id,name,summary,rating,cover.url";
        const limit = coerceLimit($limit, 500);
        const offset = coerceOffset($offset, 0);
        const sort = sanitizeSort($sort);

        const parts: string[] = [];
        parts.push(`fields ${fields};`);

        if ($search) {
            const s = Array.isArray($search) ? $search[0] : $search;
            const escaped = escapeSearch(s);
            parts.push(`search "${escaped}";`);
        }

        if ($filter) {
            let w = Array.isArray($filter) ? $filter[0] : $filter;
            w = normalizeFilter(w);
            // Trusting user to supply valid Apicalypse where; minimal guard beyond logical word normalization
            parts.push(`where ${w};`);
        }

        if (sort) parts.push(`sort ${sort};`);
        parts.push(`limit ${limit};`);
        if (offset) parts.push(`offset ${offset};`);

        const body = parts.join("\n");
        const data = await igdbRequest("games", body);
        return res.status(200).json(data);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return res
            .status(500)
            .json({ error: message || "Internal Server Error" });
    }
}
