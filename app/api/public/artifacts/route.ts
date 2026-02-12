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

  const artifacts = await prisma.artifact.findMany({
    where: { roomId: room.id },
    include: {
      agent: { select: AGENT_PUBLIC_SELECT },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(
    artifacts.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      content: a.content,
      url: a.url,
      createdAt: a.createdAt,
      agent: a.agent,
    }))
  )
}

