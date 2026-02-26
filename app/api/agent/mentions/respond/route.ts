import { NextResponse, after } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateOpenClawAgent } from "@/lib/agent-token-auth"
import { eventBroadcaster } from "@/lib/event-broadcaster"
import { getMentionDispatchTargets, enqueueOpenClawMentions } from "@/lib/mention-dispatch"
import { invokeAgent } from "@/lib/invoke-agent"
class MentionCompletionRaceError extends Error {
  constructor() {
    super("Mention completion raced with another request")
    this.name = "MentionCompletionRaceError"
  }
}

export async function POST(request: Request) {
  let requestedMentionId = ""
  try {
    const body = await request.json()
    const agentId = typeof body.agentId === "string" ? body.agentId : ""
    const mentionId = typeof body.mentionId === "string" ? body.mentionId : ""
    requestedMentionId = mentionId
    const content = typeof body.content === "string" ? body.content.trim() : ""
    const sessionUrl = typeof body.sessionUrl === "string" ? body.sessionUrl : null

    if (!agentId || !mentionId || !content) {
      return NextResponse.json({ error: "agentId, mentionId, and content are required" }, { status: 400 })
    }

    const auth = await authenticateOpenClawAgent(request, agentId)
    if ("error" in auth) return auth.error
    const now = new Date()
    const completion = await prisma.$transaction(async (tx) => {
      const mention = await tx.agentMention.findUnique({
        where: { id: mentionId },
        include: {
          room: { select: { id: true, userId: true, workspaceId: true, paused: true } },
        },
      })

      if (!mention || mention.agentId !== agentId) {
        return { state: "not-found" as const }
      }

      if (mention.status === "completed") {
        return {
          state: "already-completed" as const,
          messageId: mention.responseMessageId,
        }
      }

      if (mention.status !== "claimed") {
        return { state: "not-claimed" as const }
      }

      if (mention.leaseExpiresAt && mention.leaseExpiresAt < now) {
        return { state: "lease-expired" as const }
      }

      const responseMessageId = mention.responseMessageId ?? `ocm_${mention.id}`
      const message = await tx.message.upsert({
        where: { id: responseMessageId },
        create: {
          id: responseMessageId,
          roomId: mention.roomId,
          authorId: agentId,
          authorType: "agent",
          content,
          sessionUrl,
          userId: mention.room.userId,
        },
        update: {},
        include: {
          agent: { select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true } },
        },
      })

      const markedCompleted = await tx.agentMention.updateMany({
        where: {
          id: mention.id,
          agentId,
          status: "claimed",
          responseMessageId: null,
        },
        data: {
          status: "completed",
          completedAt: now,
          responseMessageId: message.id,
          leaseExpiresAt: null,
        },
      })

      if (markedCompleted.count !== 1) {
        throw new MentionCompletionRaceError()
      }

      return {
        state: "completed" as const,
        mention,
        message,
      }
    })

    if (completion.state === "not-found") {
      return NextResponse.json({ error: "Mention not found" }, { status: 404 })
    }

    if (completion.state === "already-completed") {
      return NextResponse.json({
        ok: true,
        alreadyCompleted: true,
        messageId: completion.messageId,
      })
    }

    if (completion.state === "not-claimed") {
      return NextResponse.json({ error: "Mention is not currently claimed" }, { status: 409 })
    }

    if (completion.state === "lease-expired") {
      return NextResponse.json({ error: "Mention lease expired; poll again to re-claim" }, { status: 409 })
    }

    const mention = completion.mention
    const message = completion.message

    const remainingClaimedCount = await prisma.agentMention.count({
      where: {
        agentId,
        status: "claimed",
      },
    })

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: remainingClaimedCount > 0 ? "running" : "idle",
        activeRoomId: remainingClaimedCount > 0 ? mention.roomId : null,
      },
    })

    eventBroadcaster.broadcast({
      type: "message",
      roomId: mention.roomId,
      data: { ...message, author: message.agent, agent: undefined },
    })
    eventBroadcaster.broadcast({ type: "room", roomId: mention.roomId, data: null })

    if (!mention.room.paused) {
      const targets = await getMentionDispatchTargets({
        roomId: mention.roomId,
        content,
        excludeAgentId: agentId,
      })

      if (targets.openClawAgents.length > 0) {
        await enqueueOpenClawMentions({
          openClawAgents: targets.openClawAgents,
          roomId: mention.roomId,
          sourceMessageId: message.id,
          prompt: content,
        })
      }

      if (targets.ozAgents.length > 0) {
        await prisma.agent.updateMany({
          where: { id: { in: targets.ozAgents.map((agent) => agent.id) } },
          data: { status: "running", activeRoomId: mention.roomId },
        })
        eventBroadcaster.broadcast({ type: "room", roomId: mention.roomId, data: null })

        after(async () => {
          await Promise.allSettled(
            targets.ozAgents.map((targetAgent) =>
              invokeAgent({
                roomId: mention.roomId,
                agentId: targetAgent.id,
                prompt: content,
                depth: 0,
                userId: mention.room.userId,
                workspaceId: mention.room.workspaceId ?? undefined,
              }).catch((err) => {
                console.error(`[agent/mentions/respond] Failed to invoke ${targetAgent.name}:`, err)
              })
            )
          )
        })
      }
    }

    return NextResponse.json({
      ok: true,
      message: { ...message, author: message.agent, agent: undefined },
    })
  } catch (error) {
    if (error instanceof MentionCompletionRaceError) {
      const latestMention = await prisma.agentMention.findUnique({
        where: { id: requestedMentionId },
        select: { responseMessageId: true },
      })
      return NextResponse.json({
        ok: true,
        alreadyCompleted: true,
        messageId: latestMention?.responseMessageId ?? null,
      })
    }
    console.error("POST /api/agent/mentions/respond error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

