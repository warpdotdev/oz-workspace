import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId, AuthError, unauthorizedResponse } from "@/lib/auth-helper"
import { eventBroadcaster } from "@/lib/event-broadcaster"

const AGENT_SELECT = {
  id: true,
  name: true,
  color: true,
  icon: true,
  status: true,
  activeRoomId: true,
}

export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId()
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")
    if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 })

    const room = await prisma.room.findUnique({ where: { id: roomId, userId } })
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const tasks = await prisma.task.findMany({
      where: { roomId },
      include: {
        assignee: { select: AGENT_SELECT },
        creator: { select: AGENT_SELECT },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(tasks)
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    console.error("GET /api/tasks error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId()
    const body = await request.json()
    const { roomId, title, description, status, priority, assigneeId, createdBy } = body

    if (!roomId || !title) {
      return NextResponse.json({ error: "roomId and title are required" }, { status: 400 })
    }

    const room = await prisma.room.findUnique({ where: { id: roomId, userId } })
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 })

    const task = await prisma.task.create({
      data: {
        title,
        description: description ?? "",
        status: status ?? "backlog",
        priority: priority ?? "medium",
        userId,
        roomId,
        assigneeId: assigneeId ?? null,
        createdBy: createdBy ?? null,
      },
      include: {
        assignee: { select: AGENT_SELECT },
        creator: { select: AGENT_SELECT },
      },
    })

    // Broadcast new task to SSE subscribers
    eventBroadcaster.broadcast({
      type: "task",
      roomId,
      data: { action: "created", task },
    })

    return NextResponse.json(task)
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    console.error("POST /api/tasks error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
