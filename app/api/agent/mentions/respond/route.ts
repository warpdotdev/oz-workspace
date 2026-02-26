import { NextResponse, after } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateOpenClawAgent } from "@/lib/agent-token-auth"
import { eventBroadcaster } from "@/lib/event-broadcaster"
import { getMentionDispatchTargets, enqueueOpenClawMentions } from "@/lib/mention-dispatch"
import { invokeAgent } from "@/lib/invoke-agent"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const agentId = typeof body.agentId === "string" ? body.agentId : ""
    const mentionId = typeof body.mentionId === "string" ? body.mentionId : ""
    const content = typeof body.content === "string" ? body.content.trim() : ""
    const sessionUrl = typeof body.sessionUrl === "string" ? body.sessionUrl : null

    if (!agentId || !mentionId || !content) {
      return NextResponse.json({ error: "agentId, mentionId, and content are required" }, { status: 400 })
    }

    const auth = await authenticateOpenClawAgent(request, agentId)
    if ("error" in auth) return auth.error

    const mention = await prisma.agentMention.findUnique({
      where: { id: mentionId },
      include: {
        room: { select: { id: true, userId: true, workspaceId: true, paused: true } },
      },
    })

    if (!mention || mention.agentId !== agentId) {
      return NextResponse.json({ error: "Mention not found" }, { status: 404 })
    }

    if (mention.status === "completed") {
      return NextResponse.json({
        ok: true,
        alreadyCompleted: true,
        messageId: mention.responseMessageId,
      })
    }

    if (mention.status !== "claimed") {
      return NextResponse.json({ error: "Mention is not currently claimed" }, { status: 409 })
    }

    const now = new Date()
    if (mention.leaseExpiresAt && mention.leaseExpiresAt < now) {
      return NextResponse.json({ error: "Mention lease expired; poll again to re-claim" }, { status: 409 })
    }

    const message = await prisma.message.create({
      data: {
        roomId: mention.roomId,
        authorId: agentId,
        authorType: "agent",
        content,
        sessionUrl,
        userId: mention.room.userId,
      },
      include: {
        agent: { select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true } },
      },
    })

    await prisma.agentMention.update({
      where: { id: mention.id },
      data: {
        status: "completed",
        completedAt: now,
        responseMessageId: message.id,
        leaseExpiresAt: null,
      },
    })

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
    console.error("POST /api/agent/mentions/respond error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

