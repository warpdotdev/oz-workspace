/**
 * Test: Warp API artifact retrieval
 *
 * Runs a real agent task that should produce an artifact, then polls the
 * task status endpoint and verifies that the `artifacts` array is present
 * and non-empty in the response.
 *
 * Usage:
 *   npx tsx tests/test-agent-artifacts.ts
 *
 * Env vars (reads from .env.local automatically via dotenv):
 *   WARP_API_KEY  – Warp API key or access token
 *   WARP_API_URL  – API base URL (defaults to https://app.warp.dev)
 */

import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env then .env.local (latter overrides)
dotenv.config({ path: path.resolve(__dirname, "../.env") })
dotenv.config({ path: path.resolve(__dirname, "../.env.local"), override: true })

// ── Config ──────────────────────────────────────────────────
const API_BASE = process.env.WARP_API_URL || "https://app.warp.dev"
const API_KEY = process.env.WARP_API_KEY
const ENVIRONMENT_ID = process.env.WARP_ENVIRONMENT_ID

const POLL_INTERVAL_MS = 5_000
const MAX_POLL_ATTEMPTS = 60 // 5 minutes

if (!API_KEY) {
  console.error("WARP_API_KEY is not set. Aborting.")
  process.exit(1)
}

if (!ENVIRONMENT_ID) {
  console.error("WARP_ENVIRONMENT_ID is not set. Aborting.")
  process.exit(1)
}

// ── Helpers ─────────────────────────────────────────────────
async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}: ${body}`)
  }
  return res.json()
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Test ────────────────────────────────────────────────────
async function main() {
  console.log("=== Warp API Artifact Retrieval Test ===\n")
  console.log(`API base : ${API_BASE}`)
  console.log(`Env ID   : ${ENVIRONMENT_ID}\n`)

  // 1. Run an agent with a prompt that should produce plan + PR artifacts
  const prompt = [
    "Do the following two things:",
    "1. Create a plan: Write a brief implementation plan (a markdown file called plan.md) for adding a health-check endpoint to a Node.js Express server.",
    "2. Open a PR: Initialize a git repo, commit plan.md, and open a pull request (you can use `gh pr create` or just `git` commands — a local PR is fine).",
    "Both of these actions should produce artifacts visible in the session.",
  ].join("\n")

  console.log("1. Starting agent task (expects plan + PR artifacts)…")
  const runRes = await api("/api/v1/agent/run", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      config: { environment_id: ENVIRONMENT_ID },
    }),
  })

  const taskId: string = runRes.run_id || runRes.task_id
  console.log(`   task_id: ${taskId}\n`)

  // 2. Poll until terminal state
  console.log("2. Polling for completion…")
  let finalResponse: Record<string, unknown> | null = null

  for (let i = 1; i <= MAX_POLL_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS)

    const status = await api(`/api/v1/agent/runs/${taskId}`)
    const state = (status.state as string)?.toUpperCase()
    console.log(`   [${i}/${MAX_POLL_ATTEMPTS}] state=${state}`)

    if (state === "SUCCEEDED" || state === "COMPLETED" || state === "FAILED" || state === "ERROR") {
      finalResponse = status
      break
    }
  }

  if (!finalResponse) {
    console.error("\n✗ FAIL – task did not reach a terminal state within timeout")
    process.exit(1)
  }

  // 3. Inspect the raw response
  console.log("\n3. Raw task response (key fields):")
  console.log(`   task_id       : ${finalResponse.task_id}`)
  console.log(`   state         : ${finalResponse.state}`)
  console.log(`   title         : ${finalResponse.title}`)
  console.log(`   session_link  : ${finalResponse.session_link}`)
  console.log(`   has artifacts : ${"artifacts" in finalResponse}`)
  console.log(`   artifacts     : ${JSON.stringify(finalResponse.artifacts, null, 2)}`)

  // 4. Assertions
  console.log("\n4. Assertions:")

  const hasField = "artifacts" in finalResponse
  console.log(`   [${hasField ? "✓" : "✗"}] 'artifacts' field present in response`)

  const artifacts = finalResponse.artifacts
  const isArray = Array.isArray(artifacts)
  console.log(`   [${isArray ? "✓" : "✗"}] 'artifacts' is an array`)

  if (isArray && artifacts.length > 0) {
    console.log(`   [✓] 'artifacts' is non-empty (count: ${artifacts.length})`)
    for (const a of artifacts) {
      console.log(`       → ${JSON.stringify(a)}`)
    }
  } else {
    console.log(`   [✗] 'artifacts' is empty — the API is not returning artifacts for this task`)
    console.log("       This confirms the bug: artifacts created in the session are not surfaced via the API.")
  }

  // 5. Also test fetching a known completed task (if one was passed via CLI arg)
  const knownTaskId = process.argv[2]
  if (knownTaskId) {
    console.log(`\n5. Re-checking known task: ${knownTaskId}`)
    try {
      const known = await api(`/api/v1/agent/runs/${knownTaskId}`)
      console.log(`   state     : ${known.state}`)
      console.log(`   artifacts : ${JSON.stringify(known.artifacts, null, 2)}`)
    } catch (e) {
      console.log(`   Error: ${e}`)
    }
  }

  console.log("\n=== Done ===")
  process.exit(hasField && isArray && (artifacts as unknown[]).length > 0 ? 0 : 1)
}

main().catch((err) => {
  console.error("Unhandled error:", err)
  process.exit(1)
})
