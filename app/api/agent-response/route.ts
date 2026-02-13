import { NextResponse, after } from "next/server"
import { prisma } from "@/lib/prisma"
import { eventBroadcaster } from "@/lib/event-broadcaster"
import { tryDecodeAgentCallbackPayload } from "@/lib/agent-callback"
import { extractMentionedNames } from "@/lib/mentions"
import { invokeAgent } from "@/lib/invoke-agent"
import { getTaskStatus } from "@/lib/oz-client"
import { saveWarpArtifacts } from "@/lib/warp-artifacts"
const DEFAULT_ORCHESTRATION_TIMEOUT_MS = 15 * 60_000

// This route can fan out follow-up invocations and persist artifacts after the response is sent.
export const maxDuration = 300
function getOrchestrationTimeoutMs() {
  const raw = process.env.ORCHESTRATION_TIMEOUT_MS
  if (!raw) return DEFAULT_ORCHESTRATION_TIMEOUT_MS
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ORCHESTRATION_TIMEOUT_MS
}
function generateInvocationId() {
  return `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}
function sanitizeDelegateText(text: string) {
  // Avoid accidental re-dispatch if the lead copies delegate responses containing @mentions.
  return text.replaceAll("@", "＠")
}
function trimForPrompt(text: string, maxChars: number) {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n\n[truncated ${text.length - maxChars} chars]`
}

// POST - Agent sends its response here
export async function POST(request: Request) {
  try {
    const body = await request.json()
    // Accept both camelCase and snake_case field names
    const taskId = body.taskId || body.task_id
    const rawResponse = body.response || body.message

    if (!taskId || !rawResponse) {
      console.log("[agent-response] Missing fields. Body keys:", Object.keys(body))
      return NextResponse.json(
        { error: "taskId and response are required" },
        { status: 400 }
      )
    }
    const response = typeof rawResponse === "string" ? rawResponse : JSON.stringify(rawResponse)
    console.log(`[agent-response] Received response for task ${taskId}:`, response.substring(0, 100))

    const url = new URL(request.url)
    const decoded = tryDecodeAgentCallbackPayload(response)

    const roomId = url.searchParams.get("roomId") ?? decoded?.roomId ?? null
    const agentId = url.searchParams.get("agentId") ?? decoded?.agentId ?? null
    const messageText = decoded?.message ?? response

    // If we have enough context, persist the agent message immediately so the room updates
    // even if the long-running invokeAgent serverless function is killed.
    if (roomId && agentId) {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { userId: true },
      })
      const userIdForInvocations = decoded?.userId ?? room?.userId ?? null

      const message = await prisma.message.upsert({
        where: { id: taskId },
        create: {
          id: taskId,
          content: messageText,
          authorType: "agent",
          sessionUrl: null,
          userId: decoded?.userId ?? room?.userId ?? null,
          roomId,
          authorId: agentId,
        },
        update: {
          content: messageText,
        },
        include: {
          agent: { select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true } },
        },
      })

      // Clear thinking state (only if agent is still tied to this room).
      await prisma.agent.updateMany({
        where: { id: agentId, activeRoomId: roomId },
        data: { status: "idle", activeRoomId: null },
      })

      eventBroadcaster.broadcast({
        type: "message",
        roomId,
        data: { ...message, author: message.agent, agent: undefined },
      })
      eventBroadcaster.broadcast({ type: "room", roomId, data: null })

      // Best-effort: persist artifacts produced by the Warp run. We can't rely on the original
      // invoker surviving long enough to poll to completion on Vercel.
      try {
        const marker = await prisma.agentCallback.findUnique({
          where: { id: `warp-run:${taskId}` },
          select: { response: true },
        })
        const warpRunId = marker?.response
        if (warpRunId) {
          after(async () => {
            for (let attempt = 0; attempt < 6; attempt++) {
              try {
                const status = await getTaskStatus(warpRunId, userIdForInvocations)
                const artifacts = status.artifacts ?? []
                if (artifacts.length > 0) {
                  await saveWarpArtifacts(artifacts, { roomId, agentId, userId: userIdForInvocations })
                  break
                }

                // If the run is terminal and still has no artifacts, don't keep retrying.
                if (status.state === "completed" || status.state === "failed") break
              } catch (err) {
                console.error("[agent-response] Failed to fetch/save artifacts:", err)
              }

              // Backoff: 2s, 4s, 6s, 8s, 10s, 12s
              await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
            }
          })
        }
      } catch (err) {
        console.error("[agent-response] Failed to schedule artifact persistence:", err)
      }

      // Fan-in: if this callback corresponds to an orchestration child run, mark it completed and
      // dispatch the lead exactly once when all children are complete.
      let activeChildOrchestration: { id: string; leadAgentId: string; status: string } | null = null
      try {
        const child = await prisma.agentOrchestrationChild.findUnique({
          where: { runId: taskId },
          include: {
            orchestration: {
              select: { id: true, leadAgentId: true, leadRunId: true, followupRunId: true, status: true },
            },
          },
        })
        if (child) {
          if (child.orchestration.status === "running") {
            activeChildOrchestration = {
              id: child.orchestration.id,
              leadAgentId: child.orchestration.leadAgentId,
              status: child.orchestration.status,
            }
          }

          // Best-effort: mark child completed (idempotent).
          await prisma.agentOrchestrationChild.updateMany({
            where: { runId: taskId, status: { not: "completed" } },
            data: { status: "completed", completedAt: new Date() },
          })

          const remaining = await prisma.agentOrchestrationChild.count({
            where: { orchestrationId: child.orchestration.id, status: { not: "completed" } },
          })

          if (
            remaining === 0 &&
            child.orchestration.status === "running" &&
            child.orchestration.followupRunId === null
          ) {
            const followupRunId = generateInvocationId()

            // Dedupe: only one callback handler should win the fan-in dispatch.
            const updated = await prisma.agentOrchestration.updateMany({
              where: { id: child.orchestration.id, followupRunId: null },
              data: { followupRunId, status: "completed" },
            })

            if (updated.count === 1) {
              const [leadMessage, children] = await Promise.all([
                prisma.message.findUnique({
                  where: { id: child.orchestration.leadRunId },
                  select: { content: true },
                }),
                prisma.agentOrchestrationChild.findMany({
                  where: { orchestrationId: child.orchestration.id },
                  include: { agent: { select: { name: true } } },
                  orderBy: { createdAt: "asc" },
                }),
              ])

              const childRunIds = children.map((c) => c.runId)
              const childMessages = await prisma.message.findMany({
                where: { id: { in: childRunIds } },
                select: { id: true, content: true },
              })
              const msgById = new Map(childMessages.map((m) => [m.id, m.content] as const))

              const delegateSections = children
                .map((c) => {
                  const raw = msgById.get(c.runId) ?? "(no response)"
                  const safe = trimForPrompt(sanitizeDelegateText(raw), 8_000)
                  return `Agent ${c.agent.name}:\n${safe}`
                })
                .join("\n\n")

              const leadOriginal = trimForPrompt(sanitizeDelegateText(leadMessage?.content ?? "(missing)"), 8_000)
              const followupPrompt = [
                "You delegated work to multiple agents. All delegate responses have arrived.",
                "",
                "Continue from the original request and produce a single consolidated response to the room.",
                "",
                "IMPORTANT: Do NOT include any @mentions in your response unless you intend to dispatch another agent.",
                "",
                "Original message:",
                leadOriginal,
                "",
                "Delegate responses:",
                delegateSections,
              ].join("\n")

              after(
                invokeAgent({
                  roomId,
                  agentId: child.orchestration.leadAgentId,
                  prompt: followupPrompt,
                  depth: 1,
                  userId: userIdForInvocations,
                  invocationId: followupRunId,
                }).catch((err) => {
                  console.error("[agent-response] Failed to invoke lead for fan-in:", err)
                })
              )
            }
          }
        }
      } catch (err) {
        console.error("[agent-response] Failed to process orchestration fan-in:", err)
      }
      // If the agent response itself contains @mentions, dispatch those teammates from here.
      // This is more reliable than relying on the long-running invokeAgent function to survive until
      // it can process agent-to-agent mentions.
      // Skip dispatch if the room is paused (responses are still accepted, but no new agents are invoked).
      const roomForPause = await prisma.room.findUnique({ where: { id: roomId }, select: { paused: true } })
      if (roomForPause?.paused) {
        console.log("[agent-response] Room is paused, skipping mention dispatch")
      } else try {
        const roomAgents = await prisma.roomAgent.findMany({
          where: { roomId },
          include: { agent: true },
        })
        const teammates = roomAgents
          .map((ra) => ra.agent)
          .filter((a) => a.id !== agentId && a.harness === "oz")

        const mentionedNames = extractMentionedNames(messageText, teammates.map((t) => t.name))
        if (mentionedNames.length > 0) {
          console.log("[agent-response] Extracted mentions:", mentionedNames)
          const mentionedSet = new Set(mentionedNames.map((n) => n.toLowerCase()))
          let mentionedAgents = teammates.filter((t) => mentionedSet.has(t.name.toLowerCase()))

          // Suppress premature delegate→lead dispatch while an orchestration is running.
          if (activeChildOrchestration?.status === "running") {
            mentionedAgents = mentionedAgents.filter((t) => t.id !== activeChildOrchestration!.leadAgentId)
          }
          if (mentionedAgents.length === 0) {
            // Mentions exist, but all were suppressed (e.g. delegate mentioning the lead).
          } else {
            const shouldOrchestrate = mentionedAgents.length >= 2
            const orchestration = shouldOrchestrate
              ? await prisma.agentOrchestration.upsert({
                  where: { leadRunId: taskId },
                  create: {
                    roomId,
                    leadAgentId: agentId,
                    leadRunId: taskId,
                    status: "running",
                    deadlineAt: new Date(Date.now() + getOrchestrationTimeoutMs()),
                  },
                  update: {},
                })
              : null

            const dispatchable: Array<{ agent: (typeof mentionedAgents)[number]; invocationId: string }> = []
            for (const mentionedAgent of mentionedAgents) {
              const markerId = `dispatch:${taskId}:${mentionedAgent.id}`
              const marker = await prisma.agentCallback.findUnique({
                where: { id: markerId },
                select: { response: true },
              })
              if (marker) {
                // Best-effort: if we have a stored invocationId, ensure an orchestration child row exists.
                if (orchestration && marker.response?.startsWith("inv_")) {
                  await prisma.agentOrchestrationChild
                    .upsert({
                      where: { runId: marker.response },
                      create: {
                        orchestrationId: orchestration.id,
                        agentId: mentionedAgent.id,
                        runId: marker.response,
                        status: "dispatched",
                      },
                      update: {},
                    })
                    .catch(() => {
                      // ignore: this is a best-effort repair for retries
                    })
                }
                continue
              }

              const childRunId = generateInvocationId()

              try {
                // Marker response stores the invocationId we will use for the child so retries can recover it.
                await prisma.agentCallback.create({ data: { id: markerId, response: childRunId } })
              } catch {
                // Best-effort de-dupe for races; if it already exists, don't dispatch again.
                continue
              }

              if (orchestration) {
                await prisma.agentOrchestrationChild
                  .create({
                    data: {
                      orchestrationId: orchestration.id,
                      agentId: mentionedAgent.id,
                      runId: childRunId,
                      status: "dispatched",
                    },
                  })
                  .catch(() => {
                    // ignore: marker de-dupe succeeded, but child row already exists (retry/race)
                  })
              }

              dispatchable.push({ agent: mentionedAgent, invocationId: childRunId })
            }

            // Optimistically mark them running so the UI shows thinking immediately.
            if (dispatchable.length > 0) {
              await prisma.agent.updateMany({
                where: { id: { in: dispatchable.map((d) => d.agent.id) } },
                data: { status: "running", activeRoomId: roomId },
              })
              eventBroadcaster.broadcast({ type: "room", roomId, data: null })
            }

            for (const { agent: mentionedAgent, invocationId } of dispatchable) {
              console.log(`[agent-response] Scheduling mentioned agent: ${mentionedAgent.name} (${invocationId})`)
              after(
                invokeAgent({
                  roomId,
                  agentId: mentionedAgent.id,
                  prompt: messageText,
                  depth: 1,
                  userId: userIdForInvocations,
                  invocationId,
                }).catch((err) => {
                  console.error(`[agent-response] Failed to invoke mentioned agent ${mentionedAgent.name}:`, err)
                })
              )
            }
          }
        }
      } catch (err) {
        console.error("[agent-response] Failed to dispatch mentioned agents:", err)
      }
    } else {
      // Store in database (upsert in case of retry) so invokeAgent can poll and create the message.
      await prisma.agentCallback.upsert({
        where: { id: taskId },
        create: { id: taskId, response: messageText },
        update: { response: messageText },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[agent-response] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// GET - Poll for agent response
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get("taskId")

    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 })
    }

    const callback = await prisma.agentCallback.findUnique({
      where: { id: taskId },
    })

    if (callback) {
      // Remove after reading (one-time use)
      await prisma.agentCallback.delete({ where: { id: taskId } })
      return NextResponse.json({ response: callback.response })
    }

    return NextResponse.json({ response: null })
  } catch (error) {
    console.error("[agent-response] GET error:", error)
    return NextResponse.json({ response: null })
  }
}
