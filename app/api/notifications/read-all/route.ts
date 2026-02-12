import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId, AuthError, unauthorizedResponse } from "@/lib/auth-helper"

export async function POST() {
  try {
    const userId = await getAuthenticatedUserId()
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    throw error
  }
}
