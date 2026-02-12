import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId, AuthError, unauthorizedResponse } from "@/lib/auth-helper"
import { invokeAgent } from "@/lib/invoke-agent"

// Agent invocation involves polling which can take several minutes
export const maxDuration = 300

export async function POST(request: Request) {
  console.log("[invoke] Received request")
  try {
    const userId = await getAuthenticatedUserId()
    const body = await request.json()
    const { roomId, agentId, prompt, depth } = body
    console.log("[invoke] Body:", { roomId, agentId, promptLength: prompt?.length, depth })

    if (!roomId || !agentId || !prompt) {
      return NextResponse.json(
        { error: "roomId, agentId, and prompt are required" },
        { status: 400 }
      )
    }

    // Prevent auth bypass: clients may not invoke with non-zero depth.
    if (depth !== undefined && depth !== 0) {
      return NextResponse.json(
        { error: "depth must be 0" },
        { status: 400 }
      )
    }

    // Verify room belongs to the authenticated user.
    const room = await prisma.room.findUnique({ where: { id: roomId, userId } })
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 })

    // Ensure the agent is actually in this room.
    const membership = await prisma.roomAgent.findUnique({
      where: { roomId_agentId: { roomId, agentId } },
      select: { id: true },
    })
    if (!membership) return NextResponse.json({ error: "Agent not found in room" }, { status: 404 })

    const result = await invokeAgent({ roomId, agentId, prompt, depth: 0, userId })

    if (!result.success && !result.message) {
      return NextResponse.json(
        { error: result.error },
        { status: result.errorStatus || 500 }
      )
    }

    return NextResponse.json(result.message)
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    console.error("POST /api/invoke error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
