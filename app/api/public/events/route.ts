import { NextRequest } from "next/server"
import { getSharedRoomByPublicShareId } from "@/lib/public-share"
import { eventBroadcaster, type BroadcastEvent } from "@/lib/event-broadcaster"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Max duration for SSE — keep high so connections aren't cut early.
export const maxDuration = 300

const POLL_INTERVAL_MS = 1000
const HEARTBEAT_INTERVAL_MS = 15000

function isRedisStreamId(value: string) {
  // Redis stream ids are typically "milliseconds-seq" (e.g. "1700000000000-0")
  return value === "0" || /^\d+-\d+$/.test(value)
}

function safeCloseController(controller: ReadableStreamDefaultController) {
  try { controller.close() } catch { /* already closed */ }
}

const PUBLIC_EVENT_TYPES = new Set(["message", "room", "task", "artifact"])

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const shareId = searchParams.get("shareId")
  const requestedCursor = searchParams.get("cursor")

  if (!shareId) {
    return new Response("shareId required", { status: 400 })
  }

  const room = await getSharedRoomByPublicShareId(shareId)
  if (!room) {
    return new Response("Not found", { status: 404 })
  }

  const roomId = room.id
  const encoder = new TextEncoder()
  let aborted = false
  let syntheticSeq = 0

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text))
        } catch {
          // Stream already closed / client disconnected
        }
      }

      const sendEvent = (event: BroadcastEvent) => {
        const type = PUBLIC_EVENT_TYPES.has(event.type) ? event.type : "room"
        const eventId = event.id ?? `${Date.now()}-${syntheticSeq++}`
        // Never forward the raw event payload (it can include private fields like userId).
        enqueue(`id: ${eventId}\nevent: ${type}\ndata: ${JSON.stringify({ type })}\n\n`)
      }

      const heartbeat = () =>
        enqueue(`event: heartbeat\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`)

      request.signal.addEventListener("abort", () => {
        aborted = true
      })

      if (eventBroadcaster.hasRedis) {
        // ── Redis Stream polling mode ──────────────────────────
        const headerCursor =
          request.headers.get("last-event-id") ||
          request.headers.get("Last-Event-ID")

        const resumeCursor = requestedCursor || headerCursor

        let cursor = resumeCursor && isRedisStreamId(resumeCursor)
          ? resumeCursor
          : await eventBroadcaster.getLatestId(roomId)

        heartbeat()

        let polling = false
        let lastHeartbeat = Date.now()

        const pollTimer = setInterval(async () => {
          if (aborted) {
            clearInterval(pollTimer)
            safeCloseController(controller)
            return
          }
          if (polling) return
          polling = true
          try {
            const [newCursor, events] = await eventBroadcaster.readStream(roomId, cursor)
            cursor = newCursor
            for (const event of events) {
              sendEvent(event)
            }
            if (Date.now() - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
              heartbeat()
              lastHeartbeat = Date.now()
            }
          } catch (e) {
            if (!aborted) console.error("[public-events] Redis poll error:", e)
          } finally {
            polling = false
          }
        }, POLL_INTERVAL_MS)

        request.signal.addEventListener("abort", () => {
          aborted = true
          clearInterval(pollTimer)
          safeCloseController(controller)
        })
      } else {
        // ── In-memory mode (local dev) ──────────────────────────
        const unsubscribe = eventBroadcaster.subscribe(roomId, sendEvent)

        const heartbeatInterval = setInterval(() => {
          if (!aborted) heartbeat()
        }, HEARTBEAT_INTERVAL_MS)

        heartbeat()

        request.signal.addEventListener("abort", () => {
          aborted = true
          clearInterval(heartbeatInterval)
          unsubscribe()
          safeCloseController(controller)
        })
      }
    },
    cancel() {
      aborted = true
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

