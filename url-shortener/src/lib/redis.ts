import { Redis } from '@upstash/redis'

declare global {
  var redisClient: Redis | undefined
}

const redis = globalThis.redisClient ?? Redis.fromEnv()

if (process.env.NODE_ENV !== 'production') {
  globalThis.redisClient = redis
}

export { redis }
export default redis
