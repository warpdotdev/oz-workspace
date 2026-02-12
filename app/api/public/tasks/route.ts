import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSharedRoomByPublicShareId } from "@/lib/public-share"

const AGENT_PUBLIC_SELECT = {
  id: true,
  name: true,
  color: true,
  icon: true,
} as const

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const shareId = searchParams.get("shareId")
  if (!shareId) return NextResponse.json({ error: "shareId required" }, { status: 400 })

  const room = await getSharedRoomByPublicShareId(shareId)
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const tasks = await prisma.task.findMany({
    where: { roomId: room.id },
    include: {
      assignee: { select: AGENT_PUBLIC_SELECT },
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(
    tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      assignee: t.assignee,
    }))
  )
}

