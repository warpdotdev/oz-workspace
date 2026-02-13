import { prisma } from "@/lib/prisma"
import { runAgent, pollForCompletion } from "@/lib/oz-client"
import { eventBroadcaster } from "@/lib/event-broadcaster"
import { extractMentionedNames } from "@/lib/mentions"
import { saveWarpArtifacts } from "@/lib/warp-artifacts"
import { after } from "next/server"

const MAX_DISPATCH_DEPTH = 20
function generateInvocationId() {
  return `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

export interface InvokeAgentParams {
  roomId: string
  agentId: string
  prompt: string
  depth?: number
  userId: string | null
  /** Optional override for the message/run id used for callbacks + persisted Message.id. */
  invocationId?: string
}

export interface InvokeAgentResult {
  success: boolean
  message?: {
    id: string
    content: string
    authorType: string
    sessionUrl: string | null
    roomId: string
    authorId: string | null
    author?: { id: string; name: string; color: string | null; icon: string | null; status: string; activeRoomId: string | null } | null
    [key: string]: unknown
  }
  error?: string
  errorStatus?: number
}

/**
 * Core agent invocation logic, shared between the /api/invoke route handler
 * and direct callers (e.g. /api/messages for @mention dispatch).
 *
 * This avoids self-referential HTTP fetches which fail on Vercel serverless.
 */
export async function invokeAgent({
  roomId,
  agentId,
  prompt,
  depth = 0,
  userId,
  invocationId: invocationIdOverride,
}: InvokeAgentParams): Promise<InvokeAgentResult> {
  console.log("[invokeAgent] Starting", { roomId, agentId, promptLength: prompt?.length, depth })

  // Prevent infinite agent-to-agent loops
  if (depth >= MAX_DISPATCH_DEPTH) {
    console.log(`[invokeAgent] Skipping: depth ${depth} >= max ${MAX_DISPATCH_DEPTH}`)
    return { success: false, error: "Max dispatch depth reached", errorStatus: 429 }
  }

  if (!roomId || !agentId || !prompt) {
    return { success: false, error: "roomId, agentId, and prompt are required", errorStatus: 400 }
  }

  // Check if room invocations are paused
  const roomForPause = await prisma.room.findUnique({ where: { id: roomId }, select: { paused: true } })
  if (roomForPause?.paused) {
    console.log("[invokeAgent] Room is paused, skipping invocation for", agentId)
    // Reset agent to idle since it was optimistically set to running but won't actually start
    await prisma.agent.updateMany({
      where: { id: agentId, activeRoomId: roomId },
      data: { status: "idle", activeRoomId: null },
    })
    eventBroadcaster.broadcast({ type: "room", roomId, data: null })
    return { success: false, error: "Room invocations are paused", errorStatus: 409 }
  }

  // Look up agent config
  const agent = await prisma.agent.findUnique({ where: { id: agentId } })
  if (!agent) {
    console.log("[invokeAgent] Agent not found:", agentId)
    return { success: false, error: "Agent not found", errorStatus: 404 }
  }
  console.log("[invokeAgent] Found agent:", { name: agent.name, harness: agent.harness })

  if (agent.harness !== "oz") {
    return { success: false, error: `Harness "${agent.harness}" is not yet supported`, errorStatus: 400 }
  }

  // Set agent to "running". For the initial call from /api/messages this is
  // already done before after() fires, but for recursive agent-to-agent
  // dispatches (depth > 0) this is the first time it's set.
  await prisma.agent.update({
    where: { id: agentId },
    data: { status: "running", activeRoomId: roomId },
  })

  eventBroadcaster.broadcast({ type: "room", roomId, data: null })

  try {
    const invocationId =
      invocationIdOverride ||
      `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const callbackBaseUrl =
      process.env.AGENT_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const callbackUrl = `${callbackBaseUrl}/api/agent-response?roomId=${encodeURIComponent(roomId)}&agentId=${encodeURIComponent(agentId)}`

    // Fetch room details and recent chat history
    const room = await prisma.room.findUnique({ where: { id: roomId } })

    const roomAgents = await prisma.roomAgent.findMany({
      where: { roomId },
      include: { agent: true },
    })
    const teammates = roomAgents
      .map((ra) => ra.agent)
      .filter((a) => a.id !== agentId && a.harness === "oz")

    const recentMessages = await prisma.message.findMany({
      where: { roomId },
      include: { agent: { select: { name: true } } },
      orderBy: { timestamp: "desc" },
      take: 20,
    })

    const chatHistory = recentMessages
      .reverse()
      .map((m) => {
        const author = m.authorType === "human" ? "User" : (m.agent?.name ?? "Agent")
        return `${author}: ${m.content}`
      })
      .join("\n")

    const roomTasks = await prisma.task.findMany({
      where: { roomId },
      include: { assignee: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    })

    const taskSummary =
      roomTasks.length > 0
        ? roomTasks
            .map((t) => {
              const assignee = t.assignee?.name ? ` (assigned: ${t.assignee.name})` : ""
              return `- [${t.status}] ${t.title}${assignee} (id: ${t.id})`
            })
            .join("\n")
        : "No tasks yet."

    const callbackInstructions = `
IMPORTANT: After completing the user's request, you MUST send your response back to the chat using the send_message skill.
The chat UI supports Markdown (headings, lists, bold, etc.).
If you want to trigger another agent, include their @mention in normal text (do NOT wrap it in backticks/code).

Call the send_message skill with:
- callback_url: "${callbackUrl}"
- task_id: "${invocationId}"
- message: Your response to the user

This is REQUIRED - your response will not be seen by the user unless you use send_message.
`

    const agentApiKey = process.env.AGENT_API_KEY || ""
    const taskInstructions = `
TASK TRACKING: You have access to the manage_tasks skill to track your work on the room's Kanban board.
Use it to create tasks for work you plan to do, move them to in_progress when you start, and mark them done when finished.

Your agent ID is: ${agentId}
Room ID: ${roomId}
Base URL for task API: ${callbackBaseUrl}
Agent API Key: ${agentApiKey}

Current room tasks:
${taskSummary}
`

    const notificationInstructions = `
NOTIFICATIONS: You have access to the send_notification skill to notify the human user via their Inbox.
Use it to alert the user about:
- Important status updates on long-running work
- Items that require human review (e.g. PRs, plans, documents)
- Task completions
- Errors or failures that need human attention

Your agent ID is: ${agentId}
Room ID: ${roomId}
Base URL for notification API: ${callbackBaseUrl}
`

    const teammateInstructions =
      teammates.length > 0
        ? `
TEAMMATES IN THIS ROOM:
You can @mention these agents to request their help. They will only respond when explicitly mentioned.
${teammates.map((t) => `- @${t.name}: ${t.systemPrompt || "No description provided"}`).join("\n")}
To mention an agent, include @agent-name in your response message (normal text; not inside \`code\`).
To mention an agent, include @agent-name in your response message.
`
        : ""

    const systemContext = agent.systemPrompt || "You are a helpful assistant."
    const identityContext = `Your name is ${agent.name}.`
    const roomContext = room?.description
      ? `\nRoom: ${room.name}\nRoom description: ${room.description}\n`
      : ""
    const fullPrompt = `${identityContext}\n${systemContext}\n\n${callbackInstructions}\n${taskInstructions}\n${notificationInstructions}\n${teammateInstructions}\n${roomContext}\nChat history:\n${chatHistory}\n\nUser request: ${prompt}`

    console.log("[invokeAgent] Calling runAgent with invocationId:", invocationId)
    console.log("[invokeAgent] Prompt length:", fullPrompt.length)

    const environmentId = agent.environmentId || process.env.WARP_ENVIRONMENT_ID
    if (!environmentId) {
      throw new Error("No environment ID configured. Configure it on the agent.")
    }
    console.log("[invokeAgent] Using environment:", environmentId)

    const taskId = await runAgent({ prompt: fullPrompt, environmentId, userId })
    console.log("[invokeAgent] Got taskId:", taskId)
    // Persist a mapping so the callback handler can recover the Warp run id
    // and save artifacts even if this serverless function times out.
    await prisma.agentCallback
      .upsert({
        where: { id: `warp-run:${invocationId}` },
        create: { id: `warp-run:${invocationId}`, response: taskId },
        update: { response: taskId },
      })
      .catch((err) => {
        console.warn("[invokeAgent] Failed to persist warp-run mapping:", err)
      })

    const result = await pollForCompletion(taskId, { userId })

    // Persist any artifacts returned by the Warp API
    if (result.artifacts && result.artifacts.length > 0) {
      await saveWarpArtifacts(result.artifacts, { roomId, agentId, userId })
    }

    // Update agent status back to idle
    await prisma.agent.update({
      where: { id: agentId },
      data: { status: "idle", activeRoomId: null },
    })

    eventBroadcaster.broadcast({ type: "room", roomId, data: null })

    if (result.state === "failed") {
      const errorMessage = await prisma.message.upsert({
        where: { id: invocationId },
        create: {
          id: invocationId,
          content: `Error: Agent task failed`,
          authorType: "agent",
          sessionUrl: result.sessionLink,
          userId,
          roomId,
          authorId: agentId,
        },
        // If a callback already persisted a response message, do not overwrite its content.
        update: {
          ...(result.sessionLink ? { sessionUrl: result.sessionLink } : {}),
        },
        include: {
          agent: { select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true } },
        },
      })

      eventBroadcaster.broadcast({
        type: "message",
        roomId,
        data: { ...errorMessage, author: errorMessage.agent, agent: undefined },
      })

      return {
        success: false,
        message: { ...errorMessage, author: errorMessage.agent, agent: undefined },
        error: "Agent task failed",
      }
    }

    let messageContent =
      result.statusMessage || (result.title ? `✓ ${result.title}` : "Task completed")
    let hasCallbackResponse = false

    // Prefer the message that is persisted by /api/agent-response (so we survive serverless timeouts).
    console.log("[invokeAgent] Waiting for callback message persistence:", invocationId)
    for (let i = 0; i < 15; i++) {
      try {
        const persisted = await prisma.message.findUnique({
          where: { id: invocationId },
          select: { content: true },
        })
        if (persisted) {
          messageContent = persisted.content
          hasCallbackResponse = true
          break
        }
      } catch (e) {
        console.log("[invokeAgent] Persisted message poll error:", e)
      }
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    // Backward compat: if the callback wasn't persisted as a Message, fall back to AgentCallback polling.
    if (!hasCallbackResponse) {
      console.log("[invokeAgent] Polling for callback response with invocationId:", invocationId)
      for (let i = 0; i < 15; i++) {
        try {
          const callback = await prisma.agentCallback.findUnique({
            where: { id: invocationId },
          })
          if (callback) {
            console.log("[invokeAgent] Got callback response:", callback.response.substring(0, 100))
            messageContent = callback.response
            hasCallbackResponse = true
            await prisma.agentCallback.delete({ where: { id: invocationId } })
            break
          }
        } catch (e) {
          console.log("[invokeAgent] Callback poll error:", e)
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    const message = await prisma.message.upsert({
      where: { id: invocationId },
      create: {
        id: invocationId,
        content: messageContent,
        authorType: "agent",
        sessionUrl: result.sessionLink,
        userId,
        roomId,
        authorId: agentId,
      },
      update: {
        ...(hasCallbackResponse ? { content: messageContent } : {}),
        ...(result.sessionLink ? { sessionUrl: result.sessionLink } : {}),
      },
      include: {
        agent: { select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true } },
      },
    })
    console.log("[invokeAgent] Created message:", {
      id: message.id,
      content: messageContent,
      sessionUrl: result.sessionLink,
    })

    eventBroadcaster.broadcast({
      type: "message",
      roomId,
      data: { ...message, author: message.agent, agent: undefined },
    })

    // Check for @mentions and recursively dispatch mentioned agents
    const mentionedNames = extractMentionedNames(message.content, teammates.map((t) => t.name))

    if (mentionedNames.length > 0) {
      console.log("[invokeAgent] Agent mentioned:", mentionedNames)
      const mentionedSet = new Set(mentionedNames.map((n) => n.toLowerCase()))
      let mentionedAgents = teammates.filter((t) => mentionedSet.has(t.name.toLowerCase()))

      // Suppress premature child→lead dispatch while an orchestration is running.
      try {
        const child = await prisma.agentOrchestrationChild.findUnique({
          where: { runId: invocationId },
          include: { orchestration: { select: { leadAgentId: true, status: true } } },
        })
        if (child?.orchestration.status === "running") {
          mentionedAgents = mentionedAgents.filter((t) => t.id !== child.orchestration.leadAgentId)
        }
      } catch {
        // Ignore orchestration lookup failures; fall back to best-effort mention dispatch.
      }

      const dispatchable: Array<{ agent: (typeof mentionedAgents)[number]; invocationId: string }> = []
      for (const mentionedAgent of mentionedAgents) {
        const markerId = `dispatch:${invocationId}:${mentionedAgent.id}`
        const marker = await prisma.agentCallback.findUnique({
          where: { id: markerId },
          select: { response: true },
        })
        if (marker) continue

        const childRunId = generateInvocationId()

        try {
          // Store the child invocationId so other dispatch paths (e.g. callback handler) can recover it.
          await prisma.agentCallback.create({ data: { id: markerId, response: childRunId } })
        } catch {
          continue
        }

        dispatchable.push({ agent: mentionedAgent, invocationId: childRunId })
      }

      if (dispatchable.length === 0) {
        console.log("[invokeAgent] No new mentioned agents to dispatch (deduped).")
      } else {
        // Optimistically set to running so the UI shows thinking quickly.
        await prisma.agent.updateMany({
          where: { id: { in: dispatchable.map((d) => d.agent.id) } },
          data: { status: "running", activeRoomId: roomId },
        })
        eventBroadcaster.broadcast({ type: "room", roomId, data: null })
      }

      const dispatchAll = async () => {
        await Promise.allSettled(
          dispatchable.map(({ agent: mentionedAgent, invocationId: childInvocationId }) => {
            console.log(`[invokeAgent] Dispatching mentioned agent: ${mentionedAgent.name} (${childInvocationId})`)
            // Direct recursive call instead of self-referential HTTP fetch
            return invokeAgent({
              roomId,
              agentId: mentionedAgent.id,
              prompt: message.content,
              depth: depth + 1,
              userId,
              invocationId: childInvocationId,
            }).catch((err) => {
              console.error(`[invokeAgent] Failed to invoke agent ${mentionedAgent.name}:`, err)
            })
          })
        )
      }

      // Keep recursive invocations alive after the current request finishes when possible.
      // If invokeAgent is called outside a request scope, fall back to best-effort fire-and-forget.
      try {
        after(dispatchAll)
      } catch (err) {
        console.warn("[invokeAgent] after() unavailable for recursive dispatch, falling back:", err)
        dispatchAll().catch((e) => console.error("[invokeAgent] Recursive dispatch failed:", e))
      }
    }

    return {
      success: true,
      message: { ...message, author: message.agent, agent: undefined },
    }
  } catch (error) {
    // Update agent status to error
    await prisma.agent.update({
      where: { id: agentId },
      data: { status: "error", activeRoomId: null },
    })
    eventBroadcaster.broadcast({ type: "room", roomId, data: null })

    // Surface failures in-chat so the user isn't left with a brief "thinking" state and no output.
    try {
      const errMsg = error instanceof Error ? error.message : "Unknown error"
      const errorMessage = await prisma.message.create({
        data: {
          content: `Error: Failed to invoke agent \"${agent.name}\": ${errMsg}`,
          authorType: "agent",
          sessionUrl: null,
          userId,
          roomId,
          authorId: agentId,
        },
        include: {
          agent: { select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true } },
        },
      })

      eventBroadcaster.broadcast({
        type: "message",
        roomId,
        data: { ...errorMessage, author: errorMessage.agent, agent: undefined },
      })
    } catch (e) {
      console.error("[invokeAgent] Failed to persist/broadcast error message:", e)
    }
    throw error
  }
}

