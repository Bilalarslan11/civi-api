import type { NextApiRequest, NextApiResponse } from "next";
import { igdbRequest } from "../../../lib/igdb";

const M = 500;
const C = 82;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MULTI_QUERY_BATCH_SIZE = 10;
const MULTI_QUERY_DELAY_MS = 300;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://zehai.dk",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface BaseGame {
  id: number;
  name: string;
  first_release_date?: number;
  version_parent?: number;
  rating?: number;
  rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  cover?: { id?: number; url?: string };
  [key: string]: unknown;
}

interface TopGameSpec {
  rank: number;
  title: string;
  search: string;
  score: number;
  year?: number;
}

interface MultiQueryResult {
  name: string;
  result: BaseGame[];
}

type RankedGame = BaseGame & {
  rank: number;
  consensusScore: number;
  weightedRating: number;
  usedRating: "total_rating" | "rating";
};

const TOP_GAMES: TopGameSpec[] = [
  { rank: 1, title: "Baldur's Gate 3", search: "Baldur's Gate 3", score: 32.12, year: 2023 },
  { rank: 2, title: "Red Dead Redemption 2", search: "Red Dead Redemption 2", score: 31.62, year: 2018 },
  { rank: 3, title: "The Legend of Zelda: Breath of the Wild", search: "The Legend of Zelda: Breath of the Wild", score: 28.88, year: 2017 },
  { rank: 4, title: "Elden Ring", search: "Elden Ring", score: 24.75, year: 2022 },
  { rank: 5, title: "The Witcher 3: Wild Hunt", search: "The Witcher 3: Wild Hunt", score: 22.75, year: 2015 },
  { rank: 6, title: "Metal Gear Solid 3: Snake Eater", search: "Metal Gear Solid 3: Snake Eater", score: 19.38, year: 2004 },
  { rank: 7, title: "Portal 2", search: "Portal 2", score: 19.25, year: 2011 },
  { rank: 8, title: "Disco Elysium", search: "Disco Elysium", score: 17.75, year: 2019 },
  { rank: 9, title: "Hades", search: "Hades", score: 17.0, year: 2020 },
  { rank: 10, title: "Bloodborne", search: "Bloodborne", score: 16.75, year: 2015 },
  { rank: 11, title: "Resident Evil 4", search: "Resident Evil 4", score: 16.38, year: 2005 },
  { rank: 12, title: "The Legend of Zelda: Ocarina of Time", search: "The Legend of Zelda: Ocarina of Time", score: 16.12, year: 1998 },
  { rank: 13, title: "Chrono Trigger", search: "Chrono Trigger", score: 15.5, year: 1995 },
  { rank: 14, title: "Grand Theft Auto V", search: "Grand Theft Auto V", score: 15.5, year: 2013 },
  { rank: 15, title: "Half-Life 2", search: "Half-Life 2", score: 14.88, year: 2004 },
  { rank: 16, title: "Resident Evil 4", search: "Resident Evil 4", score: 14.25, year: 2023 },
  { rank: 17, title: "Persona 5 Royal", search: "Persona 5 Royal", score: 14.0, year: 2019 },
  { rank: 18, title: "God of War", search: "God of War", score: 13.62, year: 2018 },
  { rank: 19, title: "Super Mario Odyssey", search: "Super Mario Odyssey", score: 13.62, year: 2017 },
  { rank: 20, title: "Final Fantasy VI", search: "Final Fantasy VI", score: 13.0, year: 1994 },
  { rank: 21, title: "Castlevania: Symphony of the Night", search: "Castlevania: Symphony of the Night", score: 12.88, year: 1997 },
  { rank: 22, title: "Half-Life: Alyx", search: "Half-Life: Alyx", score: 12.75, year: 2020 },
  { rank: 23, title: "Hollow Knight", search: "Hollow Knight", score: 12.75, year: 2017 },
  { rank: 24, title: "Metal Gear Solid 2: Sons of Liberty", search: "Metal Gear Solid 2: Sons of Liberty", score: 12.5, year: 2001 },
  { rank: 25, title: "The Legend of Zelda: A Link to the Past", search: "The Legend of Zelda: A Link to the Past", score: 12.5, year: 1991 },
  { rank: 26, title: "Clair Obscur: Expedition 33", search: "Clair Obscur: Expedition 33", score: 12.25, year: 2025 },
  { rank: 27, title: "Silent Hill 2", search: "Silent Hill 2", score: 11.75, year: 2001 },
  { rank: 28, title: "Persona 4 Golden", search: "Persona 4 Golden", score: 11.62, year: 2012 },
  { rank: 29, title: "Super Metroid", search: "Super Metroid", score: 11.38, year: 1994 },
  { rank: 30, title: "Super Mario World", search: "Super Mario World", score: 11.25, year: 1990 },
  { rank: 31, title: "Metroid Prime", search: "Metroid Prime", score: 10.88, year: 2002 },
  { rank: 32, title: "Undertale", search: "Undertale", score: 10.88, year: 2015 },
  { rank: 33, title: "Umineko When They Cry - Answer Arcs", search: "Umineko When They Cry Answer Arcs", score: 10.38 },
  { rank: 34, title: "Mass Effect 2", search: "Mass Effect 2", score: 10.25, year: 2010 },
  { rank: 35, title: "Mother 3", search: "Mother 3", score: 10.25, year: 2006 },
  { rank: 36, title: "Hollow Knight: Silksong", search: "Hollow Knight: Silksong", score: 10.0, year: 2025 },
  { rank: 37, title: "The Last of Us", search: "The Last of Us", score: 10.0, year: 2013 },
  { rank: 38, title: "Stardew Valley", search: "Stardew Valley", score: 10.0, year: 2016 },
  { rank: 39, title: "Super Mario Bros. 3", search: "Super Mario Bros. 3", score: 10.0, year: 1988 },
  { rank: 40, title: "Outer Wilds", search: "Outer Wilds", score: 9.75, year: 2019 },
  { rank: 41, title: "The Legend of Zelda: Tears of the Kingdom", search: "The Legend of Zelda: Tears of the Kingdom", score: 8.62, year: 2023 },
  { rank: 42, title: "Super Mario Galaxy 2", search: "Super Mario Galaxy 2", score: 8.38, year: 2010 },
  { rank: 43, title: "BioShock", search: "BioShock", score: 8.38, year: 2007 },
  { rank: 44, title: "Fallout: New Vegas", search: "Fallout: New Vegas", score: 7.5, year: 2010 },
  { rank: 45, title: "Dragon Quest XI S: Echoes of an Elusive Age - Definitive Edition", search: "Dragon Quest XI S Echoes of an Elusive Age Definitive Edition", score: 7.38, year: 2019 },
  { rank: 46, title: "Balatro", search: "Balatro", score: 7.12, year: 2024 },
  { rank: 47, title: "Super Mario Galaxy", search: "Super Mario Galaxy", score: 7.12, year: 2007 },
  { rank: 48, title: "Halo: Combat Evolved", search: "Halo: Combat Evolved", score: 7.0, year: 2001 },
  { rank: 49, title: "Portal", search: "Portal", score: 7.0, year: 2007 },
  { rank: 50, title: "Divinity: Original Sin II", search: "Divinity: Original Sin II", score: 6.75, year: 2017 },
];

let cache: { games: RankedGame[]; missing: string[]; expiresAt: number } | null = null;

function weightedRating(rating: number, votes: number): number {
  return (votes / (votes + M)) * rating + (M / (votes + M)) * C;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getReleaseYear(game: BaseGame): number | null {
  if (typeof game.first_release_date !== "number") {
    return null;
  }

  return new Date(game.first_release_date * 1000).getUTCFullYear();
}

function getCandidateScore(spec: TopGameSpec, game: BaseGame): number {
  const target = normalizeName(spec.title);
  const search = normalizeName(spec.search);
  const candidate = normalizeName(game.name);

  let score = 0;

  if (candidate === target) {
    score += 1000;
  } else if (candidate === search) {
    score += 900;
  } else if (candidate.includes(target) || target.includes(candidate)) {
    score += 300;
  }

  if (spec.year) {
    const releaseYear = getReleaseYear(game);

    if (releaseYear === spec.year) {
      score += 600;
    } else if (releaseYear !== null) {
      score += Math.max(0, 100 - Math.abs(releaseYear - spec.year) * 25);
    }
  }

  if (game.version_parent == null) {
    score += 50;
  }

  return score;
}

function toRankedGame(spec: TopGameSpec, game: BaseGame): RankedGame | null {
  const hasTotalRating =
    typeof game.total_rating === "number" &&
    typeof game.total_rating_count === "number";

  const rating = hasTotalRating ? game.total_rating : game.rating;
  const ratingCount = hasTotalRating
    ? game.total_rating_count
    : game.rating_count;

  if (typeof rating !== "number" || typeof ratingCount !== "number") {
    return null;
  }

  return {
    ...game,
    rank: spec.rank,
    consensusScore: spec.score,
    weightedRating: Number(weightedRating(rating, ratingCount).toFixed(2)),
    usedRating: hasTotalRating ? "total_rating" : "rating",
  };
}

function buildMultiQuery(batch: TopGameSpec[]): string {
  return batch
    .map((game) =>
      [
        'query games "rank-' + game.rank + '" {',
        "fields id,name,first_release_date,version_parent,total_rating,total_rating_count,rating,rating_count,cover.url;",
        "search " + JSON.stringify(game.search) + ";",
        "where version_parent = null;",
        "limit 10;",
        "};",
      ].join("\n")
    )
    .join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveTopGames(): Promise<{
  games: RankedGame[];
  missing: string[];
}> {
  const resolved = new Map<number, RankedGame>();
  const missing: string[] = [];

  for (let start = 0; start < TOP_GAMES.length; start += MULTI_QUERY_BATCH_SIZE) {
    const batch = TOP_GAMES.slice(start, start + MULTI_QUERY_BATCH_SIZE);
    const response = (await igdbRequest(
      "multiquery",
      buildMultiQuery(batch)
    )) as MultiQueryResult[];

    for (const spec of batch) {
      const queryResult = response.find(
        (result) => result.name === "rank-" + spec.rank
      );

      const candidate = queryResult?.result
        ?.slice()
        .sort(
          (a, b) =>
            getCandidateScore(spec, b) - getCandidateScore(spec, a)
        )[0];

      if (!candidate) {
        missing.push(spec.title);
        continue;
      }

      const rankedGame = toRankedGame(spec, candidate);

      if (!rankedGame) {
        missing.push(spec.title);
        continue;
      }

      resolved.set(spec.rank, rankedGame);
    }

    if (start + MULTI_QUERY_BATCH_SIZE < TOP_GAMES.length) {
      await sleep(MULTI_QUERY_DELAY_MS);
    }
  }

  return {
    games: [...resolved.values()].sort((a, b) => a.rank - b.rank),
    missing,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "OPTIONS") {
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    if (!cache || cache.expiresAt <= Date.now()) {
      const result = await resolveTopGames();
      cache = {
        ...result,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
    }

    return res.status(200).json({
      meta: {
        source:
          "Consensus Top 50 from Metacritic, OpenCritic, IGN, Steam, GameFAQs, Glitchwave, Backloggd and MobyGames",
        ranking: "50 points for #1 down to 1 point for #50; absent = 0",
        total: cache.games.length,
        missing: cache.missing,
      },
      games: cache.games,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
