import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId, AuthError, unauthorizedResponse } from "@/lib/auth-helper"

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId()
    const notifications = await prisma.notification.findMany({
      where: { userId },
      include: {
        room: { select: { name: true } },
        agent: { select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true } },
      },
      orderBy: { timestamp: "desc" },
    })
    return NextResponse.json(notifications)
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    console.error("GET /api/notifications error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Notifications are created by agents (server-side), so we scope via the room's userId
    const body = await request.json()
    const { roomId, agentId, message } = body

    if (!roomId || !agentId || !message) {
      return NextResponse.json(
        { error: "roomId, agentId, and message are required" },
        { status: 400 }
      )
    }

    const [room, agent] = await Promise.all([
      prisma.room.findUnique({ where: { id: roomId } }),
      prisma.agent.findUnique({ where: { id: agentId } }),
    ])

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    const notification = await prisma.notification.create({
      data: {
        message,
        userId: room.userId,
        roomId,
        agentId,
      },
      include: {
        room: { select: { name: true } },
        agent: { select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true } },
      },
    })

    return NextResponse.json(notification, { status: 201 })
  } catch (error) {
    console.error("POST /api/notifications error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
