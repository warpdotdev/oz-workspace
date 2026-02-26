import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export interface OpenClawConfig {
  pollIntervalSeconds: number
  maxMentionsPerPoll: number
  contextMessageCount: number
  leaseSeconds: number
}

export const DEFAULT_OPENCLAW_CONFIG: OpenClawConfig = {
  pollIntervalSeconds: 30,
  maxMentionsPerPoll: 5,
  contextMessageCount: 20,
  leaseSeconds: 120,
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function normalizeOpenClawConfig(value: unknown): OpenClawConfig {
  const input = (value && typeof value === "object") ? value as Record<string, unknown> : {}
  return {
    pollIntervalSeconds: clampNumber(input.pollIntervalSeconds, DEFAULT_OPENCLAW_CONFIG.pollIntervalSeconds, 5, 300),
    maxMentionsPerPoll: clampNumber(input.maxMentionsPerPoll, DEFAULT_OPENCLAW_CONFIG.maxMentionsPerPoll, 1, 20),
    contextMessageCount: clampNumber(input.contextMessageCount, DEFAULT_OPENCLAW_CONFIG.contextMessageCount, 5, 100),
    leaseSeconds: clampNumber(input.leaseSeconds, DEFAULT_OPENCLAW_CONFIG.leaseSeconds, 30, 900),
  }
}

export function parseOpenClawConfig(raw: string | null | undefined): OpenClawConfig {
  if (!raw) return { ...DEFAULT_OPENCLAW_CONFIG }
  try {
    return normalizeOpenClawConfig(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_OPENCLAW_CONFIG }
  }
}

export function stringifyOpenClawConfig(value: unknown): string {
  return JSON.stringify(normalizeOpenClawConfig(value))
}

export function generateAgentAccessToken(): string {
  return `ocw_${randomBytes(24).toString("base64url")}`
}

export function hashAgentAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function verifyAgentAccessToken(token: string, expectedHash: string | null | undefined): boolean {
  if (!expectedHash || !token) return false
  const actualHash = hashAgentAccessToken(token)
  const actualBuf = Buffer.from(actualHash, "utf8")
  const expectedBuf = Buffer.from(expectedHash, "utf8")
  if (actualBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(actualBuf, expectedBuf)
}

export function getTokenPreview(token: string): string {
  if (token.length <= 12) return token
  return `${token.slice(0, 8)}…${token.slice(-4)}`
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

type SerializedAgentSource = {
  skills: string
  mcpServers: string
  scripts: string
  openclawConfig?: string
  agentTokenHash?: string | null
  agentTokenPreview?: string | null
  [key: string]: unknown
}

export function serializeAgentForClient<T extends SerializedAgentSource>(agent: T) {
  const {
    skills,
    mcpServers,
    scripts,
    openclawConfig,
    agentTokenHash,
    ...rest
  } = agent

  return {
    ...rest,
    skills: parseJsonArray(skills),
    mcpServers: parseJsonArray(mcpServers),
    scripts: parseJsonArray(scripts),
    openclawConfig: parseOpenClawConfig(openclawConfig),
    hasAgentToken: Boolean(agentTokenHash),
  }
}

