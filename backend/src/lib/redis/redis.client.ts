import { Redis, RedisOptions } from 'ioredis'

let __client: Redis

export function getRedisClient(): Redis {
  if (!__client) {
    const options: RedisOptions = {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || "", 10),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      db: parseInt(process.env.REDIS_DB || "", 10) || 0,
      password: process.env.REDIS_PASS || undefined,
    }

    __client = new Redis(options);
  }
  return __client
}


