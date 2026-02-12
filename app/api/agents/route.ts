import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId, AuthError, unauthorizedResponse } from "@/lib/auth-helper"

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId()
    const agents = await prisma.agent.findMany({ where: { userId }, orderBy: { createdAt: "asc" } })
    return NextResponse.json(
      agents.map((a) => ({
        ...a,
        skills: JSON.parse(a.skills),
        mcpServers: JSON.parse(a.mcpServers),
        scripts: JSON.parse(a.scripts),
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
    const agent = await prisma.agent.create({
      data: {
        name: body.name,
        color: body.color ?? "#3B82F6",
        icon: body.icon ?? "robot",
        repoUrl: body.repoUrl ?? "",
        harness: body.harness ?? "claude-code",
        environmentId: body.environmentId ?? "",
        systemPrompt: body.systemPrompt ?? "",
        skills: JSON.stringify(body.skills ?? []),
        mcpServers: JSON.stringify(body.mcpServers ?? []),
        scripts: JSON.stringify(body.scripts ?? []),
        userId,
      },
    })
    return NextResponse.json({
      ...agent,
      skills: JSON.parse(agent.skills),
      mcpServers: JSON.parse(agent.mcpServers),
      scripts: JSON.parse(agent.scripts),
    })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    console.error("POST /api/agents error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
