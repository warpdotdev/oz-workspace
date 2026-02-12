import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAgentApiKey } from "@/lib/agent-auth"

const AGENT_SELECT = {
  id: true,
  name: true,
  color: true,
  icon: true,
  status: true,
  activeRoomId: true,
}

export async function GET(request: Request) {
  const authError = validateAgentApiKey(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")
    if (!roomId) {
      return NextResponse.json({ error: "roomId required" }, { status: 400 })
    }

    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

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
    console.error("GET /api/agent/tasks error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const authError = validateAgentApiKey(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { roomId, title, description, status, priority, assigneeId, createdBy } = body

    if (!roomId || !title) {
      return NextResponse.json(
        { error: "roomId and title are required" },
        { status: 400 }
      )
    }

    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description ?? "",
        status: status ?? "backlog",
        priority: priority ?? "medium",
        userId: room.userId,
        roomId,
        assigneeId: assigneeId ?? null,
        createdBy: createdBy ?? null,
      },
      include: {
        assignee: { select: AGENT_SELECT },
        creator: { select: AGENT_SELECT },
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error("POST /api/agent/tasks error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
