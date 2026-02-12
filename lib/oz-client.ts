import { prisma } from "@/lib/prisma"

const OZ_API_BASE = process.env.WARP_API_URL || "https://app.warp.dev"

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

interface RunAgentOptions {
  prompt: string
  environmentId?: string
  agentProfileId?: string
  dockerImage?: string
  mcpServerIds?: string[]
  userId?: string | null
}

// Based on actual Warp API response structure
interface TaskStatusResponse {
  task_id: string
  state: string  // "PENDING", "RUNNING", "SUCCEEDED", "FAILED", etc.
  title?: string
  prompt?: string
  created_at?: string
  started_at?: string
  updated_at?: string
  session_link?: string
  session_id?: string
  conversation_id?: string
  status_message?: {
    message?: string
  }
  is_sandbox_running?: boolean
  artifacts?: WarpArtifact[]
}

export interface WarpArtifact {
  created_at: string
  artifact_type: "PLAN" | "PULL_REQUEST" | string
  data: {
    // PLAN fields
    document_uid?: string
    notebook_uid?: string
    title?: string
    // PULL_REQUEST fields
    url?: string
    branch?: string
    [key: string]: unknown
  }
}

export interface TaskStatus {
  taskId: string
  state: "pending" | "running" | "completed" | "failed"
  title?: string
  sessionLink?: string
  statusMessage?: string
  conversationId?: string
  artifacts?: WarpArtifact[]
}

export async function runAgent(options: RunAgentOptions): Promise<string> {
  const apiKey = await getApiKey(options.userId)
  console.log("[oz-client] API key present:", !!apiKey, "length:", apiKey?.length)

  // Build request body per API docs: environment_id goes inside config object
  const requestBody: Record<string, unknown> = {
    prompt: options.prompt,
  }
  
  // Only include config if there are config options
  const config: Record<string, unknown> = {}
  if (options.environmentId) config.environment_id = options.environmentId
  if (options.agentProfileId) config.agent_profile_id = options.agentProfileId
  if (Object.keys(config).length > 0) requestBody.config = config
  
  console.log("[oz-client] Request body:", { ...requestBody, prompt: (requestBody.prompt as string)?.substring(0, 100) + "..." })
  
  const res = await fetch(`${OZ_API_BASE}/api/v1/agent/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    const error = await res.text()
    console.error("[oz-client] runAgent failed:", res.status, error)
    throw new Error(`Failed to run agent (${res.status}): ${error}`)
  }

  const data = await res.json()
  console.log("[oz-client] runAgent response:", data)
  return data.run_id || data.task_id
}

export async function getTaskStatus(taskId: string, userId?: string | null): Promise<TaskStatus> {
  const apiKey = await getApiKey(userId)

  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`${OZ_API_BASE}/api/v1/agent/runs/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (res.ok) {
      const data: TaskStatusResponse = await res.json()
      console.log("[oz-client] getTaskStatus response:", JSON.stringify(data, null, 2))
      
      // Map API state (uppercase) to our normalized state (lowercase)
      const stateUpper = data.state?.toUpperCase()
      let state: TaskStatus["state"] = "pending"
      if (stateUpper === "RUNNING" || stateUpper === "INPROGRESS") {
        state = "running"
      } else if (stateUpper === "PENDING" || stateUpper === "QUEUED") {
        state = "pending"
      } else if (stateUpper === "SUCCEEDED" || stateUpper === "COMPLETED") {
        state = "completed"
      } else if (stateUpper === "FAILED" || stateUpper === "ERROR") {
        state = "failed"
      }

      return {
        taskId: data.task_id,
        state,
        title: data.title,
        sessionLink: data.session_link,
        statusMessage: data.status_message?.message,
        conversationId: data.conversation_id,
        artifacts: data.artifacts,
      }
    }

    // Handle rate limiting with exponential backoff
    if (res.status === 429 && attempt < maxRetries) {
      const delayMs = 2000 * Math.pow(2, attempt) // 2s, 4s, 8s
      console.log(`[oz-client] Rate limited (429), retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      continue
    }

    const error = await res.text()
    lastError = new Error(`Failed to get task status: ${error}`)
    
    // For non-429 errors, don't retry
    if (res.status !== 429) {
      throw lastError
    }
  }

  // All retries exhausted
  throw lastError ?? new Error("Failed to get task status after retries")

}

export async function pollForCompletion(
  taskId: string,
  options: { maxAttempts?: number; intervalMs?: number; userId?: string | null } = {}
): Promise<TaskStatus> {
  const { maxAttempts = 60, intervalMs = 10000, userId } = options

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getTaskStatus(taskId, userId)
    console.log(`[oz-client] Poll attempt ${attempt + 1}: state=${status.state}`)

    // Check if task is in a terminal state
    if (status.state === "completed" || status.state === "failed") {
      return status
    }

    // Add jitter (±20%) to prevent synchronized polling across concurrent agents
    const jitter = intervalMs * (0.8 + Math.random() * 0.4)
    await new Promise((resolve) => setTimeout(resolve, jitter))
  }

  throw new Error(`Task ${taskId} did not complete within timeout`)
}
