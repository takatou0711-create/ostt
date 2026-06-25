// netlify/functions/tournaments.js
// start.gg GraphQL proxy + approved.json マージ（10分キャッシュ）

const ENDPOINT = 'https://api.start.gg/gql/alpha';
const CACHE_TTL = 10 * 60 * 1000;
const fs   = require('fs');
const path = require('path');

let cache = {};

// events・waves・registrationClosesAt を追加取得
const QUERY = `
  query TournamentsByGame($perPage: Int, $videogameId: ID!, $afterDate: Timestamp) {
    tournaments(query: {
      perPage: $perPage
      sortBy: "startAt asc"
      filter: {
        videogameIds: [$videogameId]
        afterDate: $afterDate
        hasOnlineEvents: false
      }
    }) {
      nodes {
        id slug name
        startAt endAt
        numAttendees
        registrationClosesAt
        city countryCode
        venueName venueAddress
        images { url type }
        waves {
          id identifier
          startAt endAt
        }
        events {
          id name
          numEntrants
          maxEntrants
          registrationClosesAt
          startAt
          state
        }
      }
    }
  }
`;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  const gameId    = event.queryStringParameters?.gameId || '1386';
  const cacheKey  = `game_${gameId}`;
  const now       = Date.now();

  // キャッシュヒット
  if (cache[cacheKey] && now - cache[cacheKey].ts < CACHE_TTL) {
    return {
      statusCode: 200,
      headers: { ...headers, 'X-Cache': 'HIT' },
      body: JSON.stringify(cache[cacheKey].data),
    };
  }

  const apiKey = process.env.STARTGG_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  const afterDate = Math.floor((now - 90 * 24 * 60 * 60 * 1000) / 1000);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { perPage: 100, videogameId: gameId, afterDate },
      }),
    });

    const json = await res.json();
    if (json.errors) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'start.gg error', detail: json.errors }) };
    }

    const startggTournaments = (json.data?.tournaments?.nodes || []).map(t => ({
      ...t,
      source: 'startgg',
      url: `https://www.start.gg/${t.slug}`,
      platform: 'startgg',
    }));

    // approved.json 読み込み
    let manualTournaments = [];
    try {
      const approvedPath = path.join(process.cwd(), 'approved.json');
      const raw    = fs.readFileSync(approvedPath, 'utf8');
      const parsed = JSON.parse(raw);
      manualTournaments = parsed.filter(t => t.startAt >= afterDate);
    } catch (_) {}

    const tournaments = [...startggTournaments, ...manualTournaments]
      .sort((a, b) => (a.startAt || 0) - (b.startAt || 0));

    const payload = { tournaments, fetchedAt: now };
    cache[cacheKey] = { ts: now, data: payload };

    return {
      statusCode: 200,
      headers: { ...headers, 'X-Cache': 'MISS' },
      body: JSON.stringify(payload),
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
