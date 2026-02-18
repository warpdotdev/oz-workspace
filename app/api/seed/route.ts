import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId, AuthError, unauthorizedResponse } from "@/lib/auth-helper"
import { seedNewAccount } from "@/lib/seed-account"

export async function POST() {
  try {
    const userId = await getAuthenticatedUserId()

    // Clear existing data for this user
    await prisma.notification.deleteMany({ where: { userId } })
    await prisma.artifact.deleteMany({ where: { userId } })
    await prisma.message.deleteMany({ where: { userId } })
    await prisma.task.deleteMany({ where: { userId } })
    // Delete room agents for user's rooms
    const userRoomIds = (await prisma.room.findMany({ where: { userId }, select: { id: true } })).map(r => r.id)
    if (userRoomIds.length > 0) {
      await prisma.roomAgent.deleteMany({ where: { roomId: { in: userRoomIds } } })
    }
    await prisma.room.deleteMany({ where: { userId } })
    await prisma.agent.deleteMany({ where: { userId } })

    // Re-seed with starter agents and room
    await seedNewAccount(userId)

    return NextResponse.json({ ok: true, message: "Seed data created successfully" })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    console.error("POST /api/seed error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
