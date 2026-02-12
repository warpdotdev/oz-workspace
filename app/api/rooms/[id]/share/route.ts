import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId, AuthError, unauthorizedResponse } from "@/lib/auth-helper"
import { eventBroadcaster } from "@/lib/event-broadcaster"

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId()
    const { id } = await params

    const existing = await prisma.room.findUnique({
      where: { id, userId },
      select: { id: true, publicShareId: true },
    })
    if (!existing) return notFound()

    if (existing.publicShareId) {
      return NextResponse.json({ publicShareId: existing.publicShareId })
    }

    // Best-effort retry in the extremely unlikely event of a UUID collision.
    for (let attempt = 0; attempt < 3; attempt++) {
      const publicShareId = crypto.randomUUID()
      try {
        await prisma.room.update({
          where: { id },
          data: { publicShareId, publicShareEnabledAt: new Date() },
        })

        // Broadcast room update so connected clients refresh state.
        eventBroadcaster.broadcast({ type: "room", roomId: id, data: null })

        return NextResponse.json({ publicShareId })
      } catch (err) {
        // Unique constraint violation (collision). Retry.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const code = (err as any)?.code as string | undefined
        if (code === "P2002" && attempt < 2) continue
        throw err
      }
    }

    return NextResponse.json({ error: "Failed to generate share link" }, { status: 500 })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    console.error("POST /api/rooms/[id]/share error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId()
    const { id } = await params

    const existing = await prisma.room.findUnique({
      where: { id, userId },
      select: { id: true, publicShareId: true },
    })
    if (!existing) return notFound()

    if (!existing.publicShareId) {
      return NextResponse.json({ ok: true })
    }

    await prisma.room.update({
      where: { id },
      data: { publicShareId: null, publicShareEnabledAt: null },
    })

    eventBroadcaster.broadcast({ type: "room", roomId: id, data: null })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    console.error("DELETE /api/rooms/[id]/share error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

