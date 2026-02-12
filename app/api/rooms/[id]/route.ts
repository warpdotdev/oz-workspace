import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId, AuthError, unauthorizedResponse } from "@/lib/auth-helper"
import { eventBroadcaster } from "@/lib/event-broadcaster"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId()
    const { id } = await params
    const room = await prisma.room.findUnique({
      where: { id, userId },
      include: {
        agents: {
          include: { agent: { select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true } } },
        },
      },
    })
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ ...room, agents: room.agents.map((ra) => ra.agent) })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    throw error
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId()
    const { id } = await params

    // Verify ownership
    const existing = await prisma.room.findUnique({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await req.json()
    const { agentIds, description } = body

    if (agentIds !== undefined) {
      await prisma.roomAgent.deleteMany({ where: { roomId: id } })
    }

    const room = await prisma.room.update({
      where: { id },
      data: {
        ...(description !== undefined && { description }),
        ...(agentIds !== undefined && {
          agents: {
            create: agentIds.map((agentId: string) => ({ agentId })),
          },
        }),
      },
      include: {
        agents: {
          include: { agent: { select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true } } },
        },
      },
    })

    const roomData = {
      ...room,
      agents: room.agents.map((ra) => ra.agent),
    }

    // Broadcast room update to SSE subscribers
    eventBroadcaster.broadcast({
      type: "room",
      roomId: id,
      data: roomData,
    })

    return NextResponse.json(roomData)
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    throw error
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId()
    const { id } = await params
    const existing = await prisma.room.findUnique({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.room.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    throw error
  }
}
