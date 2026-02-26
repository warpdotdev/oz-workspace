import { NextResponse, after } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getAuthenticatedWorkspaceContext,
  AuthError,
  ForbiddenError,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth-helper"
import { eventBroadcaster } from "@/lib/event-broadcaster"
import { invokeAgent } from "@/lib/invoke-agent"
import { getMentionDispatchTargets, enqueueOpenClawMentions } from "@/lib/mention-dispatch"

// Allow enough time for agent invocations triggered by @mentions
export const maxDuration = 300

export async function GET(request: Request) {
  try {
    const { workspaceId } = await getAuthenticatedWorkspaceContext()
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")
    if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 })

    // Verify room belongs to user
    const room = await prisma.room.findUnique({ where: { id: roomId, workspaceId } })
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200)
    const cursor = searchParams.get("cursor") // message ID to paginate before

    let cursorTimestamp: Date | undefined
    if (cursor) {
      const cursorMsg = await prisma.message.findFirst({ where: { id: cursor, roomId } })
      if (!cursorMsg) return NextResponse.json({ error: "Invalid cursor" }, { status: 400 })
      cursorTimestamp = cursorMsg.timestamp
    }

    const messages = await prisma.message.findMany({
      where: {
        roomId,
        ...(cursorTimestamp ? { timestamp: { lt: cursorTimestamp } } : {}),
      },
      include: {
        agent: { select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { timestamp: "desc" },
      take: limit,
    })

    // Reverse so messages are in chronological order
    messages.reverse()

    const hasMore = messages.length === limit

    return NextResponse.json({
      messages: messages.map((m) => ({
        ...m,
        author: m.authorType === "agent" ? m.agent : undefined,
        agent: undefined,
        user: m.authorType === "human" ? m.user : undefined,
      })),
      hasMore,
      nextCursor: messages.length > 0 ? messages[0].id : null,
    })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    if (error instanceof ForbiddenError) return forbiddenResponse(error.message)
    console.error("GET /api/messages error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}


export async function POST(request: Request) {
  try {
    const { userId, workspaceId } = await getAuthenticatedWorkspaceContext()
    const body = await request.json()
    const { roomId, content, authorType = "human", authorId, sessionUrl } = body

    // Verify room belongs to user
    const room = await prisma.room.findUnique({ where: { id: roomId, workspaceId } })
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 })

    const message = await prisma.message.create({
      data: {
        content,
        authorType,
        sessionUrl: sessionUrl ?? null,
        userId,
        roomId,
        authorId: (authorType !== "human" && authorId) ? authorId : null,
      },
      include: {
        agent: { select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true } },
        user: { select: { id: true, name: true } },
      },
    })

    const responseMessage = {
      ...message,
      author: message.authorType === "agent" ? message.agent : undefined,
      agent: undefined,
      user: message.authorType === "human" ? message.user : undefined,
    }

    // Broadcast new message to SSE subscribers
    eventBroadcaster.broadcast({
      type: "message",
      roomId,
      data: responseMessage,
    })

    // If this is a human message, check for @mentions and dispatch mentioned agents
    if (authorType === "human" && typeof content === "string" && content.includes("@") && !room.paused) {
      const targets = await getMentionDispatchTargets({
        roomId,
        content,
      })

      if (targets.mentionedAgents.length > 0) {
        console.log("[messages] Extracted mentions:", targets.mentionedAgents.map((agent) => agent.name))

        if (targets.openClawAgents.length > 0) {
          await enqueueOpenClawMentions({
            openClawAgents: targets.openClawAgents,
            roomId,
            sourceMessageId: message.id,
            prompt: content,
          })
        }

        const ozAgents = targets.ozAgents

        // Set agents to "running" NOW so the client sees the thinking state
        // immediately after the POST response (before after() fires).
        for (const agent of ozAgents) {
          await prisma.agent.update({
            where: { id: agent.id },
            data: { status: "running", activeRoomId: roomId },
          })
        }

        // Broadcast the room update so SSE subscribers also see it
        if (ozAgents.length > 0) {
          eventBroadcaster.broadcast({ type: "room", roomId, data: null })
        }
        // Dispatch the actual agent work in after() so the response returns fast.
        // Use a single after() task so multiple mentioned agents can be invoked reliably.
        after(async () => {
          await Promise.allSettled(
            ozAgents.map((mentionedAgent) => {
              console.log(`[messages] Scheduling agent dispatch: ${mentionedAgent.name}`)
              return invokeAgent({
                roomId,
                agentId: mentionedAgent.id,
                prompt: content,
                depth: 0,
                userId,
                workspaceId,
              }).catch((err) => {
                console.error(`[messages] Failed to invoke agent ${mentionedAgent.name}:`, err)
              })
            })
          )
        })
      }
    }

    return NextResponse.json(responseMessage)
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    if (error instanceof ForbiddenError) return forbiddenResponse(error.message)
    console.error("POST /api/messages error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
