import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function getAuthenticatedUserId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new AuthError()
  }
  return session.user.id
}

export class AuthError extends Error {
  constructor() {
    super("Unauthorized")
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
