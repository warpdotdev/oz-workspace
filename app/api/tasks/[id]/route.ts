import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId, AuthError, unauthorizedResponse } from "@/lib/auth-helper"
import { eventBroadcaster } from "@/lib/event-broadcaster"

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
  try {
    const userId = await getAuthenticatedUserId()
    const { id } = await params
    const existing = await prisma.task.findUnique({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

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

    // Broadcast task update to SSE subscribers
    eventBroadcaster.broadcast({
      type: "task",
      roomId: existing.roomId,
      data: { action: "updated", task },
    })

    return NextResponse.json(task)
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    console.error("PATCH /api/tasks/[id] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId()
    const { id } = await params
    const existing = await prisma.task.findUnique({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.task.delete({ where: { id } })

    // Broadcast task deletion to SSE subscribers
    eventBroadcaster.broadcast({
      type: "task",
      roomId: existing.roomId,
      data: { action: "deleted", taskId: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    console.error("DELETE /api/tasks/[id] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
