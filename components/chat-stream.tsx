"use client"

import * as React from "react"
import { ArrowRightIcon, PaperPlaneRightIcon, UserIcon, DotsThreeIcon, StopCircleIcon, PlayCircleIcon } from "@phosphor-icons/react"
import { AgentIcon } from "@/components/agent-icon"
import { AddAgentsBanner } from "@/components/add-agents-banner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MentionTextarea } from "@/components/mention-textarea"
import { useMessageStore, useRoomStore } from "@/lib/stores"
import { useRealtime } from "@/hooks/use-realtime"
import { findMentionMatches } from "@/lib/mentions"
import type { Message, AgentSummary } from "@/lib/types"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function renderInlineWithMentions(content: string, agents: AgentSummary[]) {
  // Build a map of agent names to their colors
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
function renderMarkdownWithMentions(content: string, agents: AgentSummary[]) {
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

function MessageBubble({ message, agents }: { message: Message; agents: AgentSummary[] }) {
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
            {isHuman ? "You" : (message.author?.name ?? "Agent")}
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
            <ArrowRightIcon className="h-3 w-3" />
            View session
          </a>
        )}
      </div>
    </div>
  )
}

function TypingIndicator({ agents, roomId }: { agents: AgentSummary[]; roomId: string }) {
  const runningAgents = agents.filter((a) => a.status === "running" && a.activeRoomId === roomId)
  if (runningAgents.length === 0) return null

  const names = runningAgents.map((a) => a.name).join(", ")
  const agent = runningAgents[0]

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          style={{ backgroundColor: agent.color }}
          className="text-white text-xs"
        >
          <AgentIcon icon={agent.icon} className="h-4 w-4" weight="bold" />
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{runningAgents.length === 1 ? names : `${runningAgents.length} agents`}</span>
        <span>is thinking</span>
        <DotsThreeIcon className="h-4 w-4 animate-pulse" weight="bold" />
      </div>
    </div>
  )
}

export function ChatStream({ roomId }: { roomId: string }) {
  const { messagesByRoom, sendMessage, fetchMessages } = useMessageStore()
  const { rooms, refreshRoom } = useRoomStore()
  const room = rooms.find((r) => r.id === roomId)
  const agents = room?.agents ?? []
  const messages = messagesByRoom[roomId] || []
  const [input, setInput] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [showAgentsBanner, setShowAgentsBanner] = React.useState(false)
  const [togglingPause, setTogglingPause] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Fetch messages on mount (independent of SSE)
  React.useEffect(() => {
    fetchMessages(roomId)
  }, [roomId, fetchMessages])

  // Use SSE for real-time updates
  useRealtime(roomId)
  // Fallback: while any agent is running, periodically refetch messages/room state.
  // This helps if the SSE stream gets dropped during long-running tasks.
  const hasRunningAgents = agents.some((a) => a.status === "running" && a.activeRoomId === roomId)
  const isPaused = room?.paused ?? false

  const togglePause = async (paused: boolean) => {
    setTogglingPause(true)
    try {
      await fetch(`/api/rooms/${roomId}/pause`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused }),
      })
      await refreshRoom(roomId)
    } finally {
      setTogglingPause(false)
    }
  }
  React.useEffect(() => {
    if (!hasRunningAgents) return
    const interval = setInterval(() => {
      fetchMessages(roomId)
      refreshRoom(roomId)
    }, 10_000)
    return () => clearInterval(interval)
  }, [hasRunningAgents, roomId, fetchMessages, refreshRoom])

  React.useEffect(() => {
    // Auto-scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  // Hide the banner once agents are added
  React.useEffect(() => {
    if (agents.length > 0) setShowAgentsBanner(false)
  }, [agents.length])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setSending(true)
    try {
      await sendMessage(roomId, text)
      setInput("")
      if (agents.length === 0) setShowAgentsBanner(true)

      // If the message @mentions agents, refresh the room immediately
      // so the typing indicator shows without waiting for SSE.
      const hasMentions = /@\w+/.test(text)
      if (hasMentions && agents.length > 0) {
        refreshRoom(roomId)
      }
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0">
        <ScrollArea ref={scrollRef} className="h-full">
          <div className="py-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              No messages yet. Send a message to get started.
            </div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} message={msg} agents={agents} />)
          )}
            {showAgentsBanner && <AddAgentsBanner roomId={roomId} />}
            <TypingIndicator agents={agents} roomId={roomId} />
          </div>
        </ScrollArea>
      </div>
      <div className="shrink-0 border-t px-4 py-3">
        <div className="flex items-center gap-2">
          <MentionTextarea
            value={input}
            onChange={setInput}
            onKeyDown={handleKeyDown}
            agents={agents}
            placeholder="Message this room..."
            className="min-h-[36px] max-h-[120px]"
            rows={1}
          />
          {(hasRunningAgents || isPaused) && (
            <Button
              size="icon"
              variant={isPaused ? "default" : "destructive"}
              className="shrink-0"
              disabled={togglingPause}
              onClick={() => togglePause(!isPaused)}
              title={isPaused ? "Resume invocations" : "Stop invocations"}
            >
              {isPaused ? (
                <PlayCircleIcon className="h-4 w-4" />
              ) : (
                <StopCircleIcon className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            size="icon"
            className="shrink-0"
            disabled={!input.trim() || sending}
            onClick={handleSend}
          >
            <PaperPlaneRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
