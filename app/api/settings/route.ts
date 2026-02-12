import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId, AuthError, unauthorizedResponse } from "@/lib/auth-helper"

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId()
    const settings = await prisma.setting.findMany({ where: { userId } })
    const result: Record<string, string> = {}
    for (const s of settings) {
      result[s.key] = s.value
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    throw error
  }
}

export async function PUT(req: Request) {
  try {
    const userId = await getAuthenticatedUserId()
    const { key, value } = await req.json()
    if (!key || typeof value !== "string") {
      return NextResponse.json({ error: "key and value are required" }, { status: 400 })
    }
    const setting = await prisma.setting.upsert({
      where: { userId_key: { userId, key } },
      update: { value },
      create: { key, value, userId },
    })
    return NextResponse.json(setting)
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    throw error
  }
}
