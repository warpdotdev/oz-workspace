import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { serializeAgentForClient, stringifyOpenClawConfig } from "@/lib/openclaw"
import {
  getAuthenticatedWorkspaceContext,
  AuthError,
  ForbiddenError,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth-helper"

export async function GET() {
  try {
    const { workspaceId } = await getAuthenticatedWorkspaceContext()
    const agents = await prisma.agent.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } })
    return NextResponse.json(agents.map((a) => serializeAgentForClient(a)))
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    if (error instanceof ForbiddenError) return forbiddenResponse(error.message)
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const { userId, workspaceId } = await getAuthenticatedWorkspaceContext()
    const body = await request.json()
    const harness = typeof body.harness === "string" ? body.harness : "oz"
    const agent = await prisma.agent.create({
      data: {
        name: body.name,
        color: body.color ?? "#3B82F6",
        icon: body.icon ?? "robot",
        repoUrl: body.repoUrl ?? "",
        harness,
        environmentId: body.environmentId ?? "",
        systemPrompt: body.systemPrompt ?? "",
        openclawConfig: stringifyOpenClawConfig(body.openclawConfig),
        skills: JSON.stringify(body.skills ?? []),
        mcpServers: JSON.stringify(body.mcpServers ?? []),
        scripts: JSON.stringify(body.scripts ?? []),
        workspaceId,
        userId,
      },
    })
    return NextResponse.json(serializeAgentForClient(agent))
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    if (error instanceof ForbiddenError) return forbiddenResponse(error.message)
    console.error("POST /api/agents error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
