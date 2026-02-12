import { Redis } from "@upstash/redis"

// Returns an Upstash Redis client if credentials are configured, null otherwise.
// When null (e.g. local dev without Redis), the event broadcaster falls back to in-memory.
function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token, readYourWrites: false })
}

const globalForRedis = globalThis as unknown as { redis: Redis | null | undefined }

export const redis: Redis | null =
  globalForRedis.redis !== undefined ? globalForRedis.redis : createRedisClient()

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis
}
