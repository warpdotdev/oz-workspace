import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId, AuthError, unauthorizedResponse } from "@/lib/auth-helper"

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId()
    const rooms = await prisma.room.findMany({
      where: { userId },
      include: {
        agents: {
          include: { agent: { select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(
      rooms.map((r) => ({
        ...r,
        agents: r.agents.map((ra) => ra.agent),
      }))
    )
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId()
    const body = await request.json()
    const { name, description = "", agentIds = [] } = body

    const room = await prisma.room.create({
      data: {
        name,
        description,
        userId,
        agents: {
          create: agentIds.map((agentId: string) => ({
            agent: { connect: { id: agentId } },
          })),
        },
      },
      include: {
        agents: {
          include: { agent: { select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true } } },
        },
      },
    })

    return NextResponse.json({
      ...room,
      agents: room.agents.map((ra) => ra.agent),
    })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    console.error("POST /api/rooms error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
