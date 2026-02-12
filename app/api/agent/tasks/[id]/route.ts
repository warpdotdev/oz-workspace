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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateAgentApiKey(request)
  if (authError) return authError

  try {
    const { id } = await params
    const existing = await prisma.task.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, status, priority, assigneeId } = body

    const data: Record<string, unknown> = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (status !== undefined) data.status = status
    if (priority !== undefined) data.priority = priority
    if (assigneeId !== undefined) {
      data.assignee = assigneeId
        ? { connect: { id: assigneeId } }
        : { disconnect: true }
    }

    const task = await prisma.task.update({
      where: { id },
      data,
      include: {
        assignee: { select: AGENT_SELECT },
        creator: { select: AGENT_SELECT },
      },
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error("PATCH /api/agent/tasks/[id] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
