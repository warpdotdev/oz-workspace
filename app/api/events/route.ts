import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId, AuthError } from "@/lib/auth-helper"
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

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId()
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")
    const requestedCursor = searchParams.get("cursor")

    if (!roomId) {
      return new Response("roomId required", { status: 400 })
    }

    // Verify room belongs to user
    const room = await prisma.room.findUnique({ where: { id: roomId, userId } })
    if (!room) {
      return new Response("Room not found", { status: 404 })
    }
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
          const eventId = event.id ?? `${Date.now()}-${syntheticSeq++}`
          enqueue(`id: ${eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`)
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

          console.log(`[events] SSE connected room=${roomId} cursor=${cursor}${resumeCursor ? " (resume)" : ""}`)

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
                console.log(`[events] SSE => ${event.type}`)
                sendEvent(event)
              }
              if (Date.now() - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
                heartbeat()
                lastHeartbeat = Date.now()
              }
            } catch (e) {
              if (!aborted) console.error("[events] Redis poll error:", e)
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
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response("Unauthorized", { status: 401 })
    }
    console.error("GET /api/events error:", error)
    return new Response("Internal error", { status: 500 })
  }
}
