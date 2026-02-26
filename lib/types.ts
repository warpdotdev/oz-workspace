export type HarnessType = "codex" | "claude-code" | "gemini-cli" | "oz" | "openclaw" | "custom"
export type AgentStatus = "idle" | "running" | "error"
export type AuthorType = "human" | "agent"
export type ArtifactType = "plan" | "pr" | "document" | "sheet"
export type TaskStatus = "backlog" | "in_progress" | "done"
export type TaskPriority = "low" | "medium" | "high"
export type WorkspaceRole = "OWNER" | "MEMBER"

export interface Room {
  id: string
  name: string
  description: string
  paused?: boolean
  publicShareId?: string | null
  createdAt: string
  agents?: AgentSummary[]
}

export interface AgentSummary {
  id: string
  name: string
  color: string
  icon: string
  status: AgentStatus
  activeRoomId?: string | null
}

export interface Agent {
  id: string
  name: string
  color: string
  icon: string
  repoUrl: string
  harness: HarnessType
  environmentId: string
  systemPrompt: string
  openclawConfig: {
    pollIntervalSeconds: number
    maxMentionsPerPoll: number
    contextMessageCount: number
    leaseSeconds: number
  }
  hasAgentToken?: boolean
  agentTokenPreview?: string | null
  skills: string[]
  mcpServers: string[]
  scripts: string[]
  status: AgentStatus
  createdAt: string
}

export interface Message {
  id: string
  roomId: string
  authorId: string
  authorType: AuthorType
  content: string
  sessionUrl?: string | null
  timestamp: string
  author?: AgentSummary
  user?: {
    id: string
    name: string
  } | null
}

export interface Artifact {
  id: string
  roomId: string
  type: ArtifactType
  title: string
  content: string
  url?: string | null
  createdBy?: string | null
  createdAt: string
  agent?: AgentSummary | null
}

export interface Task {
  id: string
  roomId: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assigneeId?: string | null
  createdBy?: string | null
  createdAt: string
  updatedAt: string
  assignee?: AgentSummary | null
  creator?: AgentSummary | null
}

export interface Notification {
  id: string
  roomId: string
  agentId: string
  message: string
  read: boolean
  timestamp: string
  room?: { name: string }
  agent?: AgentSummary
}

export interface Workspace {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  role: WorkspaceRole
  currentUserId: string
}

export interface WorkspaceMember {
  userId: string
  role: WorkspaceRole
  invitedByUserId?: string | null
  createdAt: string
  user: {
    id: string
    name: string
    email: string
  }
}

export interface WorkspaceInvite {
  id: string
  workspaceId: string
  createdByUserId: string
  role: WorkspaceRole
  createdAt: string
  acceptedAt?: string | null
  expiresAt?: string | null
  inviteUrl?: string
}
