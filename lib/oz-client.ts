import OzAPI from "oz-agent-sdk"
import type { ArtifactItem, RunItem } from "oz-agent-sdk/resources/agent/runs"
import { prisma } from "@/lib/prisma"
import { warpRateLimiter } from "@/lib/rate-limiter"

// Re-export SDK types so consumers don't need to import from the SDK directly.
export type { ArtifactItem }

async function getApiKey(userId?: string | null): Promise<string> {
  let apiKey: string | undefined
  if (userId) {
    const setting = await prisma.setting.findUnique({ where: { userId_key: { userId, key: "warp_api_key" } } })
    apiKey = setting?.value
  }
  apiKey = apiKey || process.env.WARP_API_KEY
  if (!apiKey) {
    throw new Error("Warp API key is not configured. Set it in Settings or via the WARP_API_KEY environment variable.")
  }
  return apiKey
}

function getOzClient(apiKey: string): OzAPI {
  // The SDK default base URL is https://app.warp.dev/api/v1.
  // WARP_API_URL is the root (e.g. https://app.warp.dev), so append /api/v1.
  const baseURL = process.env.WARP_API_URL
    ? `${process.env.WARP_API_URL.replace(/\/+$/, "")}/api/v1`
    : undefined

  return new OzAPI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    maxRetries: 3,
  })
}

interface RunAgentOptions {
  prompt: string
  environmentId?: string
  userId?: string | null
}

export interface TaskStatus {
  taskId: string
  state: "pending" | "running" | "completed" | "failed"
  title?: string
  sessionLink?: string
  statusMessage?: string
  conversationId?: string
  artifacts?: ArtifactItem[]
}

function mapRunState(state: RunItem["state"]): TaskStatus["state"] {
  switch (state) {
    case "INPROGRESS":
    case "CLAIMED":
      return "running"
    case "PENDING":
    case "QUEUED":
      return "pending"
    case "SUCCEEDED":
      return "completed"
    case "FAILED":
    case "CANCELLED":
      return "failed"
    default:
      return "pending"
  }
}

function mapRunItemToTaskStatus(data: RunItem): TaskStatus {
  return {
    taskId: data.run_id || data.task_id,
    state: mapRunState(data.state),
    title: data.title,
    sessionLink: data.session_link,
    statusMessage: data.status_message?.message,
    conversationId: data.conversation_id,
    artifacts: data.artifacts,
  }
}

export async function runAgent(options: RunAgentOptions): Promise<string> {
  const apiKey = await getApiKey(options.userId)
  console.log("[oz-client] API key present:", !!apiKey, "length:", apiKey?.length)

  const client = getOzClient(apiKey)

  const config: OzAPI.AmbientAgentConfig = {}
  if (options.environmentId) config.environment_id = options.environmentId

  console.log("[oz-client] Request:", { prompt: options.prompt?.substring(0, 100) + "...", config })

  const response = await warpRateLimiter.enqueue(() =>
    client.agent.run({
      prompt: options.prompt,
      ...(Object.keys(config).length > 0 ? { config } : {}),
    })
  )

  console.log("[oz-client] runAgent response:", response)
  // The API may return run_id or the deprecated task_id depending on version.
  return response.run_id || response.task_id
}

export async function getTaskStatus(taskId: string, userId?: string | null): Promise<TaskStatus> {
  const apiKey = await getApiKey(userId)
  const client = getOzClient(apiKey)

  return retrieveTaskStatus(client, taskId)
}

async function retrieveTaskStatus(client: OzAPI, taskId: string): Promise<TaskStatus> {
  const data = await warpRateLimiter.enqueue(() => client.agent.runs.retrieve(taskId))
  console.log("[oz-client] getTaskStatus response:", JSON.stringify(data, null, 2))

  return mapRunItemToTaskStatus(data)
}

export async function pollForCompletion(
  taskId: string,
  options: { maxAttempts?: number; intervalMs?: number; userId?: string | null } = {}
): Promise<TaskStatus> {
  const { maxAttempts = 60, intervalMs = 10000, userId } = options

  // Resolve API key and client once for the entire polling loop.
  const apiKey = await getApiKey(userId)
  const client = getOzClient(apiKey)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await retrieveTaskStatus(client, taskId)
    console.log(`[oz-client] Poll attempt ${attempt + 1}: state=${status.state}`)

    if (status.state === "completed" || status.state === "failed") {
      return status
    }

    // Add jitter (±20%) to prevent synchronized polling across concurrent agents
    const jitter = intervalMs * (0.8 + Math.random() * 0.4)
    await new Promise((resolve) => setTimeout(resolve, jitter))
  }

  throw new Error(`Task ${taskId} did not complete within timeout`)
}
