"use client"

import * as React from "react"
import { HashIcon, ArrowUpIcon, ArrowDownIcon, EqualsIcon, FileTextIcon, GitPullRequestIcon, NotepadIcon, TableIcon, ArrowSquareOutIcon, UserIcon, type IconProps } from "@phosphor-icons/react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AgentIcon } from "@/components/agent-icon"
import { Separator } from "@/components/ui/separator"
import { usePublicRealtime } from "@/hooks/use-public-realtime"
import { findMentionMatches } from "@/lib/mentions"

type PublicAgent = {
  id: string
  name: string
  color: string
  icon: string
}

type PublicRoom = {
  shareId: string
  name: string
  description: string
  createdAt: string
  agents: PublicAgent[]
}

type PublicMessage = {
  id: string
  authorType: "human" | "agent" | string
  content: string
  sessionUrl?: string | null
  timestamp: string
  author?: PublicAgent
}

type PublicTask = {
  id: string
  title: string
  description: string
  status: "backlog" | "in_progress" | "done" | string
  priority: "low" | "medium" | "high" | string
  createdAt: string
  updatedAt: string
  assignee?: PublicAgent | null
}

type PublicArtifact = {
  id: string
  type: "plan" | "pr" | "document" | "sheet" | string
  title: string
  content: string
  url?: string | null
  createdAt: string
  agent?: PublicAgent | null
}

function renderInlineWithMentions(content: string, agents: PublicAgent[]) {
  const agentMap = new Map(agents.map((a) => [a.name.toLowerCase(), a]))
  const matches = findMentionMatches(content, agents.map((a) => a.name))
  if (matches.length === 0) return content

  const nodes: React.ReactNode[] = []
  let cursor = 0

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    if (m.start > cursor) {
      nodes.push(content.slice(cursor, m.start))
    }

    const mentionText = content.slice(m.start, m.end)
    const agent = agentMap.get(m.name.toLowerCase())
    if (agent) {
      nodes.push(
        <span
          key={`mention-${i}`}
          className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: agent.color }}
          />
          {mentionText}
        </span>
      )
    } else {
      nodes.push(mentionText)
    }

    cursor = m.end
  }

  if (cursor < content.length) {
    nodes.push(content.slice(cursor))
  }

  return nodes
}

function renderMarkdownWithMentions(content: string, agents: PublicAgent[]) {
  const renderChildren = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === "string") return renderInlineWithMentions(children, agents)
    if (Array.isArray(children)) return children.map((c) => renderChildren(c))
    if (React.isValidElement(children)) return children
    return children
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="mt-2 text-base font-semibold">{renderChildren(children)}</h1>,
        h2: ({ children }) => <h2 className="mt-2 text-sm font-semibold">{renderChildren(children)}</h2>,
        h3: ({ children }) => <h3 className="mt-2 text-sm font-medium">{renderChildren(children)}</h3>,
        p: ({ children }) => <p className="mt-1 whitespace-pre-wrap">{renderChildren(children)}</p>,
        ul: ({ children }) => <ul className="mt-1 ml-4 list-disc space-y-0.5">{renderChildren(children)}</ul>,
        ol: ({ children }) => <ol className="mt-1 ml-4 list-decimal space-y-0.5">{renderChildren(children)}</ol>,
        li: ({ children }) => <li className="whitespace-pre-wrap">{renderChildren(children)}</li>,
        blockquote: ({ children }) => (
          <blockquote className="mt-1 border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground">
            {renderChildren(children)}
          </blockquote>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {renderChildren(children)}
          </a>
        ),
        pre: ({ children }) => (
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 text-xs">
            {children}
          </pre>
        ),
        code: ({ children, className }) => {
          const isBlock = typeof className === "string" && className.length > 0
          if (isBlock) {
            return <code className={className}>{children}</code>
          }
          return (
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {children}
            </code>
          )
        },
        strong: ({ children }) => <strong className="font-semibold">{renderChildren(children)}</strong>,
        em: ({ children }) => <em className="italic">{renderChildren(children)}</em>,
        hr: () => <hr className="my-2 border-muted" />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function MessageBubble({ message, agents }: { message: PublicMessage; agents: PublicAgent[] }) {
  const isHuman = message.authorType === "human"

  return (
    <div className="flex items-start gap-3 px-4 py-2 hover:bg-muted/50 transition-colors">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          style={{
            backgroundColor: isHuman ? "#6B7280" : (message.author?.color ?? "#3B82F6"),
          }}
          className="text-white text-xs"
        >
          {isHuman ? (
            <UserIcon weight="bold" className="h-4 w-4" />
          ) : (
            <AgentIcon icon={message.author?.icon ?? "robot"} className="h-4 w-4" weight="bold" />
          )}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">
            {isHuman ? "Human" : (message.author?.name ?? "Agent")}
          </span>
          <span className="text-xs text-muted-foreground">{formatTime(message.timestamp)}</span>
        </div>
        <div className="text-sm mt-0.5">
          {renderMarkdownWithMentions(message.content, agents)}
        </div>
        {message.sessionUrl && (
          <a
            href={message.sessionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline"
          >
            View session
            <ArrowSquareOutIcon className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  )
}

const COLUMNS: Array<{ status: PublicTask["status"]; label: string }> = [
  { status: "backlog", label: "Backlog" },
  { status: "in_progress", label: "In Progress" },
  { status: "done", label: "Done" },
]
type PhosphorIcon = React.ComponentType<IconProps>

const priorityConfig: Record<string, { label: string; icon: PhosphorIcon; color: string }> = {
  high: { label: "High", icon: ArrowUpIcon, color: "text-red-500" },
  medium: { label: "Med", icon: EqualsIcon, color: "text-yellow-500" },
  low: { label: "Low", icon: ArrowDownIcon, color: "text-blue-500" },
}

function SharedTaskCard({ task }: { task: PublicTask }) {
  const prio = priorityConfig[task.priority] ?? priorityConfig.medium
  const PrioIcon = prio.icon

  return (
    <div className="flex flex-col gap-1.5 rounded-md border bg-card p-2.5 text-sm shadow-xs">
      <div className="flex items-start gap-2">
        <span className="flex-1 font-medium text-xs leading-snug">{task.title}</span>
        <Badge variant="outline" className="gap-0.5 h-4 text-[0.5625rem] px-1.5">
          <PrioIcon className={`h-2.5 w-2.5 ${prio.color}`} weight="bold" />
          {prio.label}
        </Badge>
      </div>
      {task.description && (
        <p className="text-[0.6875rem] text-muted-foreground line-clamp-2">
          {task.description}
        </p>
      )}
      {task.assignee && (
        <div className="flex items-center gap-1.5">
          <Avatar className="h-4 w-4">
            <AvatarFallback
              style={{ backgroundColor: task.assignee.color }}
              className="text-white text-[0.5rem]"
            >
              <AgentIcon icon={task.assignee.icon} className="h-2.5 w-2.5" weight="bold" />
            </AvatarFallback>
          </Avatar>
          <span className="text-[0.6875rem] text-muted-foreground">
            {task.assignee.name}
          </span>
        </div>
      )}
    </div>
  )
}

function SharedKanbanBoard({ tasks }: { tasks: PublicTask[] }) {
  const grouped = React.useMemo(() => {
    const g: Record<string, PublicTask[]> = { backlog: [], in_progress: [], done: [] }
    for (const t of tasks) {
      if (g[t.status]) g[t.status].push(t)
      else g.backlog.push(t)
    }
    return g
  }, [tasks])

  return (
    <div className="flex h-full gap-2 p-2">
      {COLUMNS.map((col) => (
        <div
          key={col.status}
          className="flex flex-col min-w-0 min-h-0 flex-1 rounded-lg bg-muted/30"
        >
          <div className="flex items-center gap-1.5 px-2.5 py-2">
            <h3 className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider">
              {col.label}
            </h3>
            <Badge variant="secondary" className="h-4 min-w-4 text-[0.5625rem] px-1">
              {(grouped[col.status] ?? []).length}
            </Badge>
          </div>
          <ScrollArea className="flex-1 px-1.5">
            <div className="space-y-1.5 pb-1.5">
              {(grouped[col.status] ?? []).map((task) => (
                <SharedTaskCard key={task.id} task={task} />
              ))}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  )
}

const artifactTypeConfig: Record<string, { label: string; icon: PhosphorIcon }> = {
  plan: { label: "Plans", icon: NotepadIcon },
  pr: { label: "PRs", icon: GitPullRequestIcon },
  document: { label: "Documents", icon: FileTextIcon },
  sheet: { label: "Sheets", icon: TableIcon },
}

function SharedArtifactCard({ artifact }: { artifact: PublicArtifact }) {
  const config = artifactTypeConfig[artifact.type] ?? { label: "Artifacts", icon: FileTextIcon }
  const Icon = config.icon
  const ownerName = artifact.agent?.name ?? "Human"
  const ownerColor = artifact.agent?.color

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="truncate">{artifact.title}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          {ownerColor && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: ownerColor }}
            />
          )}
          <span className="truncate">{ownerName}</span>
        </div>
      </div>
      {artifact.url && (
        <a
          href={artifact.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowSquareOutIcon className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  )
}

function SharedArtifactsPanel({ artifacts }: { artifacts: PublicArtifact[] }) {
  const grouped = React.useMemo(() => {
    const groups: Record<string, PublicArtifact[]> = { plan: [], pr: [], document: [], sheet: [] }
    for (const a of artifacts) {
      if (groups[a.type]) groups[a.type].push(a)
    }
    return groups
  }, [artifacts])

  const sections: Array<{ type: string; items: PublicArtifact[] }> = [
    { type: "plan", items: grouped.plan },
    { type: "pr", items: grouped.pr },
    { type: "document", items: grouped.document },
    { type: "sheet", items: grouped.sheet },
  ]
  const present = sections.filter(({ type, items }) => artifactTypeConfig[type] && items.length > 0)

  return (
    <ScrollArea className="h-full">
      <div className="py-4 space-y-4">
        {artifacts.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No artifacts yet.
          </div>
        ) : (
          <>
            {present.map(({ type, items }, idx) => {
              const cfg = artifactTypeConfig[type]
              return (
                <React.Fragment key={type}>
                  <div>
                    <h3 className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {cfg.label}
                    </h3>
                    <div className="space-y-1 px-4">
                      {items.map((a) => (
                        <SharedArtifactCard key={a.id} artifact={a} />
                      ))}
                    </div>
                  </div>
                  {idx < present.length - 1 && <Separator className="mx-4" />}
                </React.Fragment>
              )
            })}
          </>
        )}
      </div>
    </ScrollArea>
  )
}

async function fetchJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    return { ok: false, status: res.status, error: body || res.statusText }
  }
  return { ok: true, data: await res.json() }
}

export function SharedRoom({ shareId }: { shareId: string }) {
  const [room, setRoom] = React.useState<PublicRoom | null>(null)
  const [messages, setMessages] = React.useState<PublicMessage[]>([])
  const [tasks, setTasks] = React.useState<PublicTask[]>([])
  const [artifacts, setArtifacts] = React.useState<PublicArtifact[]>([])
  const [status, setStatus] = React.useState<"loading" | "ready" | "not-found" | "error">("loading")
  const [error, setError] = React.useState<string | null>(null)

  const refreshRoom = React.useCallback(async () => {
    const result = await fetchJson<PublicRoom>(`/api/public/rooms/${encodeURIComponent(shareId)}`)
    if (!result.ok) {
      if (result.status === 404) setStatus("not-found")
      return
    }
    setRoom(result.data)
    setStatus("ready")
  }, [shareId])

  const refreshMessages = React.useCallback(async () => {
    const result = await fetchJson<PublicMessage[]>(`/api/public/messages?shareId=${encodeURIComponent(shareId)}`)
    if (!result.ok) return
    setMessages(result.data)
  }, [shareId])

  const refreshTasks = React.useCallback(async () => {
    const result = await fetchJson<PublicTask[]>(`/api/public/tasks?shareId=${encodeURIComponent(shareId)}`)
    if (!result.ok) return
    setTasks(result.data)
  }, [shareId])

  const refreshArtifacts = React.useCallback(async () => {
    const result = await fetchJson<PublicArtifact[]>(`/api/public/artifacts?shareId=${encodeURIComponent(shareId)}`)
    if (!result.ok) return
    setArtifacts(result.data)
  }, [shareId])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      setStatus("loading")
      setError(null)

      const roomRes = await fetchJson<PublicRoom>(`/api/public/rooms/${encodeURIComponent(shareId)}`)
      if (cancelled) return
      if (!roomRes.ok) {
        setStatus(roomRes.status === 404 ? "not-found" : "error")
        setError(roomRes.error)
        return
      }

      setRoom(roomRes.data)
      setStatus("ready")

      const [msgRes, taskRes, artRes] = await Promise.all([
        fetchJson<PublicMessage[]>(`/api/public/messages?shareId=${encodeURIComponent(shareId)}`),
        fetchJson<PublicTask[]>(`/api/public/tasks?shareId=${encodeURIComponent(shareId)}`),
        fetchJson<PublicArtifact[]>(`/api/public/artifacts?shareId=${encodeURIComponent(shareId)}`),
      ])
      if (cancelled) return
      if (msgRes.ok) setMessages(msgRes.data)
      if (taskRes.ok) setTasks(taskRes.data)
      if (artRes.ok) setArtifacts(artRes.data)
    })().catch((e) => {
      if (cancelled) return
      setStatus("error")
      setError(e instanceof Error ? e.message : "Unknown error")
    })

    return () => {
      cancelled = true
    }
  }, [shareId])

  usePublicRealtime({
    shareId,
    refreshRoom,
    refreshMessages,
    refreshTasks,
    refreshArtifacts,
  })

  if (status === "loading") {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Loading shared room…
      </div>
    )
  }

  if (status === "not-found") {
    return (
      <div className="flex h-svh items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <h1 className="text-sm font-semibold">This room isn’t shared</h1>
          <p className="text-sm text-muted-foreground">
            The link may have been revoked or is invalid.
          </p>
        </div>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex h-svh items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <h1 className="text-sm font-semibold">Failed to load</h1>
          <p className="text-sm text-muted-foreground">{error ?? "Unknown error"}</p>
        </div>
      </div>
    )
  }

  const agents = room?.agents ?? []

  return (
    <Tabs defaultValue="chat" className="flex h-svh flex-col">
      <header className="flex h-12 items-center gap-2 border-b px-4">
        <HashIcon className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold flex-1">{room?.name ?? "Shared room"}</h1>
        <Badge variant="secondary" className="text-xs">Read-only</Badge>
        <TabsList>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
        </TabsList>
      </header>

      <TabsContent value="chat" className="flex-1 min-h-0">
        <div className="flex h-full flex-col">
          <ScrollArea className="flex-1">
            <div className="py-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  No messages yet.
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} agents={agents} />
                ))
              )}
            </div>
          </ScrollArea>
          <div className="shrink-0 border-t px-4 py-3 text-xs text-muted-foreground">
            Shared view (read-only). To participate, you’ll need access in the owner’s workspace.
          </div>
        </div>
      </TabsContent>

      <TabsContent value="tasks" className="flex-1 min-h-0">
        <SharedKanbanBoard tasks={tasks} />
      </TabsContent>

      <TabsContent value="artifacts" className="flex-1 min-h-0">
        <SharedArtifactsPanel artifacts={artifacts} />
      </TabsContent>
    </Tabs>
  )
}

