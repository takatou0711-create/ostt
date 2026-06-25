// netlify/functions/tournaments.js
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const ENDPOINT_HOST = 'api.start.gg';
const ENDPOINT_PATH = '/gql/alpha';
const CACHE_TTL     = 10 * 60 * 1000;

let cache = {};

// スキーマエラーを起こしていたフィールドを除去:
// Wave.endAt, Event.maxEntrants, Event.registrationClosesAt
const QUERY = `
  query TournamentsByGame($perPage: Int, $videogameId: ID!, $afterDate: Timestamp, $beforeDate: Timestamp) {
    tournaments(query: {
      perPage: $perPage
      sortBy: "startAt asc"
      filter: {
        videogameIds: [$videogameId]
        afterDate: $afterDate
        beforeDate: $beforeDate
        hasOnlineEvents: false
        countryCode: "JP"
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
        events {
          name
          numEntrants
        }
      }
    }
  }
`;

function httpsPost(body, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: ENDPOINT_HOST,
      path: ENDPOINT_PATH,
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization':  `Bearer ${apiKey}`,
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch(e) { reject(new Error('JSON parse error: ' + raw.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  const gameId   = event.queryStringParameters?.gameId || '1386';
  const cacheKey = `game_${gameId}`;
  const now      = Date.now();

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

  const afterDate  = Math.floor(now / 1000);               // 現在以降
    const beforeDate = Math.floor(now / 1000) + 90 * 24 * 60 * 60; // 3ヶ月以内

  try {
    const json = await httpsPost(
      { query: QUERY, variables: { perPage: 100, videogameId: gameId, afterDate, beforeDate } },
      apiKey
    );

    if (json.errors) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'start.gg error', detail: json.errors }) };
    }

    const startggTournaments = (json.data?.tournaments?.nodes || []).map(t => ({
      ...t,
      source: 'startgg',
      url: `https://www.start.gg/${t.slug}`,
      platform: 'startgg',
    }));

    let manualTournaments = [];
    try {
      const raw = fs.readFileSync(path.join(process.cwd(), 'approved.json'), 'utf8');
      manualTournaments = JSON.parse(raw).filter(t => t.startAt >= afterDate);
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
