import type { NextApiRequest } from "next";

interface ClientPrincipal {
    userId?: string;
    userDetails?: string;
}

export function getSwaUserId(req: NextApiRequest): string | null {
    const encoded = req.headers["x-ms-client-principal"];
    if (typeof encoded !== "string") return null;

    try {
        const principal = JSON.parse(
            Buffer.from(encoded, "base64").toString("utf8")
        ) as ClientPrincipal;
        return principal.userId || principal.userDetails || null;
    } catch {
        return null;
    }
}