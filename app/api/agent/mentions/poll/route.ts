import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateOpenClawAgent } from "@/lib/agent-token-auth"
import { parseOpenClawConfig } from "@/lib/openclaw"
import { eventBroadcaster } from "@/lib/event-broadcaster"

function clamp(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const agentId = typeof body.agentId === "string" ? body.agentId : ""
    if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 })

    const auth = await authenticateOpenClawAgent(request, agentId)
    if ("error" in auth) return auth.error

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, openclawConfig: true },
    })
    if (!agent) return NextResponse.json({ error: "OpenClaw agent not found" }, { status: 404 })

    const config = parseOpenClawConfig(agent.openclawConfig)
    const limit = clamp(body.limit, config.maxMentionsPerPoll, 1, 20)
    const contextCount = clamp(body.contextMessageCount, config.contextMessageCount, 5, 100)
    const leaseSeconds = clamp(body.leaseSeconds, config.leaseSeconds, 30, 900)
    const now = new Date()
    const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000)
    const expiredClaimsReleased = await prisma.agentMention.updateMany({
      where: {
        agentId,
        status: "claimed",
        OR: [
          { leaseExpiresAt: null },
          { leaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        status: "pending",
        claimedAt: null,
        leaseExpiresAt: null,
        failureReason: "lease expired",
      },
    })

    const activeClaimedMentions = await prisma.agentMention.findMany({
      where: {
        agentId,
        status: "claimed",
        leaseExpiresAt: { gte: now },
      },
      include: {
        room: { select: { id: true, name: true, description: true } },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    })

    let mentions = activeClaimedMentions

    if (mentions.length === 0) {
      const candidates = await prisma.agentMention.findMany({
        where: {
          agentId,
          OR: [
            { status: "pending" },
            { status: "claimed", leaseExpiresAt: { lt: now } },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: Math.max(limit * 3, limit),
      })

      const claimedIds: string[] = []
      for (const candidate of candidates) {
        const claimed = await prisma.agentMention.updateMany({
          where: {
            id: candidate.id,
            OR: [
              { status: "pending" },
              { status: "claimed", leaseExpiresAt: { lt: now } },
            ],
          },
          data: {
            status: "claimed",
            claimedAt: now,
            leaseExpiresAt,
            failureReason: null,
          },
        })

        if (claimed.count === 1) {
          claimedIds.push(candidate.id)
        }
        if (claimedIds.length >= limit) break
      }

      if (claimedIds.length > 0) {
        mentions = await prisma.agentMention.findMany({
          where: { id: { in: claimedIds } },
          include: {
            room: { select: { id: true, name: true, description: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      }
    }

    if (mentions.length === 0) {
      return NextResponse.json({
        mentions: [],
        pollIntervalSeconds: config.pollIntervalSeconds,
        leaseSeconds,
        expiredClaimsReleased: expiredClaimsReleased.count,
      })
    }

    const messagesByRoom = new Map<string, Array<{
      id: string
      timestamp: Date
      authorType: string
      content: string
      sessionUrl: string | null
      user: { name: string } | null
      agent: { name: string } | null
    }>>()
    for (const mention of mentions) {
      if (!messagesByRoom.has(mention.roomId)) {
        const contextMessages = await prisma.message.findMany({
          where: { roomId: mention.roomId },
          include: {
            agent: { select: { name: true } },
            user: { select: { name: true } },
          },
          orderBy: { timestamp: "desc" },
          take: contextCount,
        })
        messagesByRoom.set(mention.roomId, contextMessages)
      }
    }

    const responseMentions = mentions.map((mention) => {
      const context = (messagesByRoom.get(mention.roomId) ?? [])
        .slice()
        .reverse()
        .map((message) => ({
          id: message.id,
          timestamp: message.timestamp,
          authorType: message.authorType,
          authorName: message.authorType === "human"
            ? (message.user?.name ?? "User")
            : (message.agent?.name ?? "Agent"),
          content: message.content,
          sessionUrl: message.sessionUrl,
        }))

      return {
        mentionId: mention.id,
        roomId: mention.roomId,
        sourceMessageId: mention.sourceMessageId,
        prompt: mention.prompt,
        claimedAt: mention.claimedAt,
        leaseExpiresAt: mention.leaseExpiresAt,
        room: mention.room,
        context,
      }
    })

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: "running",
        activeRoomId: responseMentions.length === 1 ? responseMentions[0].roomId : null,
      },
    })

    const roomIds = new Set(responseMentions.map((mention) => mention.roomId))
    for (const roomId of roomIds) {
      eventBroadcaster.broadcast({ type: "room", roomId, data: null })
    }

    return NextResponse.json({
      mentions: responseMentions,
      pollIntervalSeconds: config.pollIntervalSeconds,
      leaseSeconds,
      expiredClaimsReleased: expiredClaimsReleased.count,
    })
  } catch (error) {
    console.error("POST /api/agent/mentions/poll error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

