// Lightweight IGDB client utilities (token caching + request helper)
export type TwitchToken = {
    access_token: string;
    expires_in: number; // seconds
    token_type: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

function getEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is not set`);
    return v;
}

export async function getAccessToken(): Promise<string> {
    const now = Date.now();
    if (cachedToken && now < cachedToken.expiresAt - 60_000) {
        return cachedToken.token;
    }

    const client_id = getEnv("TWITCH_CLIENT_ID");
    const client_secret = getEnv("TWITCH_CLIENT_SECRET");

    const resp = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id,
            client_secret,
            grant_type: "client_credentials",
        }),
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to get Twitch token: ${resp.status} ${text}`);
    }

    const data = (await resp.json()) as TwitchToken;
    cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
    };
    return cachedToken.token;
}

export async function igdbRequest(path: string, body: string) {
    const token = await getAccessToken();
    const clientId = getEnv("TWITCH_CLIENT_ID");

    const resp = await fetch(`https://api.igdb.com/v4/${path}`, {
        method: "POST",
        headers: {
            "Client-ID": clientId,
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "text/plain",
        },
        body,
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`IGDB ${path} error: ${resp.status} ${text}`);
    }

    return resp.json();
}
