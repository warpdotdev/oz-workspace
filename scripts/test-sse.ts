#!/usr/bin/env npx tsx
/**
 * Quick integration test for the SSE pipeline.
 *
 * Run:  npx tsx scripts/test-sse.ts
 *
 * Tests:
 *   1. Redis XADD + XRANGE round-trip (direct REST API)
 *   2. SSE stream opens and delivers events via /api/test-sse
 *   3. Broadcast via POST → arrives on SSE stream
 */

import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(__dirname, "../.env.local") })

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL!
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!
const APP_URL = process.env.TEST_APP_URL || "http://localhost:3000"
const ROOM_ID = `test-sse-${Date.now()}`

// ─── Helpers ───────────────────────────────────────────────

async function rawRedis(args: string[]): Promise<unknown> {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  })
  const json = (await res.json()) as { result: unknown }
  return json.result
}

function passed(label: string) {
  console.log(`  ✅ ${label}`)
}
function failed(label: string, detail?: string) {
  console.log(`  ❌ ${label}${detail ? ": " + detail : ""}`)
}

// ─── Test 1: Redis round-trip ──────────────────────────────

async function testRedisRoundTrip(): Promise<boolean> {
  console.log("\n── Test 1: Redis Round-Trip ──")

  const key = `room:${ROOM_ID}:events`

  const id = await rawRedis(["XADD", key, "*", "type", "test", "data", '{"hello":"world"}'])
  console.log(`  XADD => ${id}`)

  const entries = await rawRedis(["XRANGE", key, "-", "+", "COUNT", "5"])
  console.log(`  XRANGE => ${JSON.stringify(entries)}`)

  // Clean up
  await rawRedis(["DEL", key])

  if (id && Array.isArray(entries) && entries.length > 0) {
    passed("Redis XADD + XRANGE works")
    return true
  }
  failed("Redis round-trip failed")
  return false
}

// ─── Test 2: SSE stream opens and polls ────────────────────

async function testSSEStream(): Promise<boolean> {
  console.log("\n── Test 2: SSE Stream Opens ──")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(`${APP_URL}/api/test-sse?roomId=${ROOM_ID}`, {
      signal: controller.signal,
      headers: { Accept: "text/event-stream" },
    })

    console.log(`  HTTP ${res.status} Content-Type: ${res.headers.get("content-type")}`)

    if (res.status !== 200 || !res.body) {
      failed("Could not open SSE stream", `status=${res.status}`)
      clearTimeout(timeout)
      return false
    }

    // Read the first few chunks to confirm the stream is alive
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let received = ""

    // Read up to 3 seconds for the initial comment/debug event
    const readStart = Date.now()
    while (Date.now() - readStart < 3000) {
      const { value, done } = await reader.read()
      if (done) break
      received += decoder.decode(value, { stream: true })
      if (received.includes("debug")) break
    }

    reader.cancel()
    clearTimeout(timeout)

    console.log(`  Received: ${received.trim().split("\n").join(" | ")}`)

    if (received.includes("connected") || received.includes("debug")) {
      passed("SSE stream opened and sent initial data")
      return true
    }

    failed("SSE stream opened but no initial data")
    return false
  } catch (err: unknown) {
    clearTimeout(timeout)
    const msg = err instanceof Error ? err.message : String(err)
    failed("SSE connection error", msg)
    return false
  }
}

// ─── Test 3: Broadcast → SSE delivery ──────────────────────

async function testBroadcastDelivery(): Promise<boolean> {
  console.log("\n── Test 3: Broadcast → SSE Delivery ──")

  const sseController = new AbortController()
  const timeout = setTimeout(() => sseController.abort(), 15000)

  try {
    // 1. Open SSE stream
    const sseRes = await fetch(`${APP_URL}/api/test-sse?roomId=${ROOM_ID}`, {
      signal: sseController.signal,
      headers: { Accept: "text/event-stream" },
    })

    if (!sseRes.body) {
      failed("Could not open SSE stream")
      clearTimeout(timeout)
      return false
    }

    const reader = sseRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    // 2. Wait 2s for the stream to stabilize, then broadcast
    console.log("  Waiting 2s for stream to stabilize...")
    await new Promise((r) => setTimeout(r, 2000))

    console.log("  Broadcasting test event via POST...")
    const postRes = await fetch(`${APP_URL}/api/test-sse?roomId=${ROOM_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "test-broadcast-delivery" }),
    })
    const postBody = await postRes.json()
    console.log(`  POST response: ${JSON.stringify(postBody)}`)

    // 3. Read SSE stream for up to 10 seconds, looking for the test event
    console.log("  Waiting for event on SSE stream...")
    const readStart = Date.now()
    let foundEvent = false

    while (Date.now() - readStart < 10000 && !foundEvent) {
      const { value, done } = await reader.read()
      if (done) {
        console.log("  Stream ended unexpectedly")
        break
      }

      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk

      // Check for our test event
      if (buffer.includes("test-broadcast-delivery")) {
        foundEvent = true
      }

      // Log each frame
      const frames = chunk.split("\n\n").filter((f) => f.trim())
      for (const frame of frames) {
        const oneLine = frame.split("\n").join(" | ")
        console.log(`  SSE frame: ${oneLine}`)
      }
    }

    reader.cancel()
    clearTimeout(timeout)

    if (foundEvent) {
      passed("Broadcast event delivered via SSE")
      return true
    }

    failed("Event NOT delivered via SSE within 10 seconds")
    console.log(`  Buffer received: ${buffer.slice(0, 500)}`)
    return false
  } catch (err: unknown) {
    clearTimeout(timeout)
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("abort")) {
      failed("Timed out waiting for SSE event (15s)")
    } else {
      failed("Error during test", msg)
    }
    return false
  }
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════")
  console.log("  SSE Pipeline Integration Test")
  console.log("═══════════════════════════════════")
  console.log(`Redis: ${REDIS_URL?.slice(0, 40)}...`)
  console.log(`App:   ${APP_URL}`)
  console.log(`Room:  ${ROOM_ID}`)

  const results: boolean[] = []

  results.push(await testRedisRoundTrip())
  results.push(await testSSEStream())
  results.push(await testBroadcastDelivery())

  // Cleanup Redis test stream
  await rawRedis(["DEL", `room:${ROOM_ID}:events`])

  console.log("\n═══════════════════════════════════")
  const passed = results.filter(Boolean).length
  console.log(`  Results: ${passed}/${results.length} passed`)
  console.log("═══════════════════════════════════")

  process.exit(passed === results.length ? 0 : 1)
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
