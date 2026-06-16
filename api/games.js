const { Redis } = require('@upstash/redis');

const MAX_SAVED_GAMES = 100;

let redisClient;

const getRedis = () => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }

  return redisClient;
};

const getSessionKey = (sessionId) => `vball-randomizer:sessions:${sessionId}:games`;

const parseBody = (body) => {
  if (!body) {
    return {};
  }

  if (typeof body === 'string') {
    return JSON.parse(body);
  }

  return body;
};

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

module.exports = async function handler(req, res) {
  let body;

  try {
    body = parseBody(req.body);
  } catch (error) {
    return sendJson(res, 400, { error: 'invalid JSON body' });
  }

  const redis = getRedis();
  const query = req.query || {};
  const sessionId = query.sessionId || body.sessionId;

  if (!sessionId || typeof sessionId !== 'string') {
    return sendJson(res, 400, { error: 'sessionId is required' });
  }

  if (!redis) {
    return sendJson(res, 200, {
      ok: false,
      games: [],
      persistence: 'disabled'
    });
  }

  const sessionKey = getSessionKey(sessionId);

  try {
    if (req.method === 'GET') {
      const savedGames = await redis.lrange(sessionKey, 0, -1);
      const games = savedGames.map((game) => (
        typeof game === 'string' ? JSON.parse(game) : game
      ));

      return sendJson(res, 200, { games, persistence: 'enabled' });
    }

    if (req.method === 'POST') {
      if (!body.game || typeof body.game !== 'object') {
        return sendJson(res, 400, { error: 'game is required' });
      }

      await redis.rpush(sessionKey, JSON.stringify(body.game));
      await redis.ltrim(sessionKey, -MAX_SAVED_GAMES, -1);

      return sendJson(res, 200, { ok: true, persistence: 'enabled' });
    }

    if (req.method === 'DELETE') {
      await redis.del(sessionKey);
      return sendJson(res, 200, { ok: true, persistence: 'enabled' });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return sendJson(res, 405, { error: 'method not allowed' });
  } catch (error) {
    return sendJson(res, 500, {
      error: 'persistence failed'
    });
  }
};
