import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const AGENT_PUBLIC_SELECT = {
  id: true,
  name: true,
  color: true,
  icon: true,
} as const

export async function GET(_req: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params

  const room = await prisma.room.findUnique({
    where: { publicShareId: shareId },
    include: {
      agents: { include: { agent: { select: AGENT_PUBLIC_SELECT } } },
    },
  })

  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    shareId,
    name: room.name,
    description: room.description,
    createdAt: room.createdAt,
    agents: room.agents.map((ra) => ra.agent),
  })
}

