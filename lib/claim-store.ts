import { Redis } from "@upstash/redis"

export interface ClaimStore {
  getLastClaim(uniqueIdentifier: string): Promise<number | null>
  recordClaim(uniqueIdentifier: string, timestamp: number, wallet?: string): Promise<void>
}

export function createRedisStore(): ClaimStore {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

  return {
    async getLastClaim(uniqueIdentifier: string): Promise<number | null> {
      return redis.get<number>(`claim:${uniqueIdentifier}`)
    },

    async recordClaim(uniqueIdentifier: string, timestamp: number, wallet?: string): Promise<void> {
      const SEVEN_DAYS = 7 * 24 * 60 * 60
      await redis.set(`claim:${uniqueIdentifier}`, timestamp, { ex: SEVEN_DAYS })
      if (wallet) {
        await redis.set(`wallet:${uniqueIdentifier}`, wallet, { ex: SEVEN_DAYS })
      }
    },
  }
}

export function createMemoryStore(): ClaimStore {
  const claims = new Map<string, number>()

  return {
    async getLastClaim(uniqueIdentifier: string): Promise<number | null> {
      return claims.get(uniqueIdentifier) ?? null
    },

    async recordClaim(uniqueIdentifier: string, timestamp: number): Promise<void> {
      claims.set(uniqueIdentifier, timestamp)
    },
  }
}

let defaultStore: ClaimStore | null = null

export function getStore(): ClaimStore {
  if (!defaultStore) {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      defaultStore = createRedisStore()
    } else {
      console.warn("[ClaimStore] Upstash Redis env vars not set — falling back to in-memory store")
      defaultStore = createMemoryStore()
    }
  }
  return defaultStore
}

export function resetStore(store?: ClaimStore): void {
  defaultStore = store ?? null
}
