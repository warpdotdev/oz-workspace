import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateOpenClawAgent } from "@/lib/agent-token-auth"
import { eventBroadcaster } from "@/lib/event-broadcaster"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const agentId = typeof body.agentId === "string" ? body.agentId : ""
    const mentionId = typeof body.mentionId === "string" ? body.mentionId : ""
    const reason = typeof body.reason === "string" ? body.reason : null

    if (!agentId || !mentionId) {
      return NextResponse.json({ error: "agentId and mentionId are required" }, { status: 400 })
    }

    const auth = await authenticateOpenClawAgent(request, agentId)
    if ("error" in auth) return auth.error

    const mention = await prisma.agentMention.findUnique({
      where: { id: mentionId },
      select: { id: true, agentId: true, roomId: true, status: true },
    })

    if (!mention || mention.agentId !== agentId) {
      return NextResponse.json({ error: "Mention not found" }, { status: 404 })
    }
    if (mention.status === "completed") {
      return NextResponse.json({ error: "Completed mentions cannot be released" }, { status: 409 })
    }

    await prisma.agentMention.update({
      where: { id: mention.id },
      data: {
        status: "pending",
        claimedAt: null,
        leaseExpiresAt: null,
        failureReason: reason,
      },
    })

    const remainingClaimedCount = await prisma.agentMention.count({
      where: { agentId, status: "claimed" },
    })

    if (remainingClaimedCount === 0) {
      await prisma.agent.update({
        where: { id: agentId },
        data: { status: "idle", activeRoomId: null },
      })
      eventBroadcaster.broadcast({ type: "room", roomId: mention.roomId, data: null })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("POST /api/agent/mentions/release error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

