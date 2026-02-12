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

  const messages = await prisma.message.findMany({
    where: { roomId: room.id },
    include: {
      agent: { select: AGENT_PUBLIC_SELECT },
    },
    orderBy: { timestamp: "asc" },
  })

  return NextResponse.json(
    messages.map((m) => ({
      id: m.id,
      authorType: m.authorType,
      content: m.content,
      sessionUrl: m.sessionUrl,
      timestamp: m.timestamp,
      author: m.authorType === "agent" ? m.agent : undefined,
    }))
  )
}

