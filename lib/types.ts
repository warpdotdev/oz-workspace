export type HarnessType = "codex" | "claude-code" | "gemini-cli" | "oz" | "custom"
export type AgentStatus = "idle" | "running" | "error"
export type AuthorType = "human" | "agent"
export type ArtifactType = "plan" | "pr" | "document" | "sheet"
export type TaskStatus = "backlog" | "in_progress" | "done"
export type TaskPriority = "low" | "medium" | "high"

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
