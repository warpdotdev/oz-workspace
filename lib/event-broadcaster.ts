// Server-side event broadcaster for SSE real-time updates
// Uses Redis Streams in production (cross-instance), in-memory in local dev.

import { redis } from "@/lib/redis"

export type EventType = "message" | "room" | "task" | "agent" | "notification" | "artifact"

export interface BroadcastEvent {
  /** Optional unique event id (e.g. Redis Stream entry id) for SSE resume. */
  id?: string
  type: EventType
  roomId: string
  data: unknown
}

type Subscriber = (event: BroadcastEvent) => void

const STREAM_MAXLEN = 1000
const REDIS_COMMAND_TIMEOUT_MS = 8_000

function streamKey(roomId: string) {
  return `room:${roomId}:events`
}

// ─── Raw Upstash REST API calls (bypass SDK for reads) ─────
// The SDK's readYourWrites sync tokens cause xrange to hang.

async function rawRedisCommand(args: string[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REDIS_COMMAND_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      const body = await response.text()
      console.error("[event-broadcaster] Redis command error:", response.status, body)
      return null
    }

    const json = await response.json()
    return json.result
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[event-broadcaster] Redis command timed out: ${args[0]}`)
    } else {
      console.error("[event-broadcaster] Redis command failed:", err)
    }
    return null
  }
}

/** Parse raw XRANGE / XREVRANGE result: [[id, [field, value, ...]], ...] */
function parseStreamEntries(raw: unknown): Array<{ id: string; fields: Record<string, string> }> {
  if (!Array.isArray(raw)) return []
  return raw.map((entry: unknown) => {
    const [id, kvArray] = entry as [string, string[]]
    const fields: Record<string, string> = {}
    for (let i = 0; i < kvArray.length; i += 2) {
      fields[kvArray[i]] = kvArray[i + 1]
    }
    return { id, fields }
  })
}

// ─── In-memory fallback (local dev without Redis) ──────────

class InMemoryBroadcaster {
  private subscribers = new Map<string, Set<Subscriber>>()

  subscribe(roomId: string, callback: Subscriber): () => void {
    if (!this.subscribers.has(roomId)) {
      this.subscribers.set(roomId, new Set())
    }
    this.subscribers.get(roomId)!.add(callback)
    return () => {
      const subs = this.subscribers.get(roomId)
      if (subs) {
        subs.delete(callback)
        if (subs.size === 0) this.subscribers.delete(roomId)
      }
    }
  }

  broadcast(event: BroadcastEvent): void {
    const subs = this.subscribers.get(event.roomId)
    if (subs) {
      for (const cb of subs) {
        try { cb(event) } catch (e) {
          console.error("[event-broadcaster] In-memory subscriber error:", e)
        }
      }
    }
  }
}

const globalForBroadcaster = globalThis as unknown as { inMemoryBroadcaster: InMemoryBroadcaster }
const inMemoryBroadcaster = globalForBroadcaster.inMemoryBroadcaster || new InMemoryBroadcaster()
if (process.env.NODE_ENV !== "production") {
  globalForBroadcaster.inMemoryBroadcaster = inMemoryBroadcaster
}

// ─── Public API ────────────────────────────────────────────

export const eventBroadcaster = {
  /** Write an event. Uses Redis Streams when available, in-memory otherwise. */
  broadcast(event: BroadcastEvent): void {
    // Always notify local in-memory subscribers (for local dev)
    inMemoryBroadcaster.broadcast(event)

    // If Redis is configured, also persist to a stream for cross-instance delivery
    if (redis) {
      redis
        .xadd(streamKey(event.roomId), "*", {
          type: event.type,
          data: JSON.stringify(event.data),
        }, { trim: { type: "MAXLEN", threshold: STREAM_MAXLEN, comparison: "~" as const } })
        .catch((err) => console.error("[event-broadcaster] Redis XADD error:", err))
    }
  },

  /** Subscribe to in-memory events (local dev only). */
  subscribe(roomId: string, callback: Subscriber): () => void {
    return inMemoryBroadcaster.subscribe(roomId, callback)
  },

  /**
   * Read new events from the Redis Stream after `cursor`.
   * Uses raw Upstash REST API to avoid SDK sync-token hangs.
   */
  async readStream(
    roomId: string,
    cursor: string,
  ): Promise<[string, BroadcastEvent[]]> {
    if (!process.env.UPSTASH_REDIS_REST_URL) return [cursor, []]

    // Compute inclusive start that skips the cursor entry
    let start: string
    if (cursor === "0") {
      start = "-"
    } else {
      const [ts, seq] = cursor.split("-")
      start = `${ts}-${parseInt(seq, 10) + 1}`
    }

    const key = streamKey(roomId)
    const raw = await rawRedisCommand(["XRANGE", key, start, "+", "COUNT", "50"])
    const entries = parseStreamEntries(raw)
    if (entries.length === 0) return [cursor, []]

    const events: BroadcastEvent[] = []
    let lastId = cursor

    for (const { id, fields } of entries) {
      lastId = id
      try {
        let data: unknown = fields.data
        if (typeof data === "string") {
          try { data = JSON.parse(data) } catch { /* keep as string */ }
        }
        events.push({
          id,
          type: fields.type as EventType,
          roomId,
          data,
        })
      } catch (e) {
        console.error("[event-broadcaster] Failed to parse stream entry:", e)
      }
    }

    return [lastId, events]
  },

  /** Get the latest stream ID (used to start reading only new events). */
  async getLatestId(roomId: string): Promise<string> {
    if (!process.env.UPSTASH_REDIS_REST_URL) return "0"

    const key = streamKey(roomId)
    const raw = await rawRedisCommand(["XREVRANGE", key, "+", "-", "COUNT", "1"])
    const entries = parseStreamEntries(raw)

    if (entries.length > 0) return entries[0].id
    return "0"
  },

  /** Whether Redis-backed streaming is available. */
  get hasRedis(): boolean {
    return redis !== null
  },
}
