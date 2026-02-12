"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { AgentSummary } from "@/lib/types"

interface MentionTextareaProps
  extends Omit<React.ComponentProps<"textarea">, "onChange"> {
  agents: AgentSummary[]
  value: string
  onChange: (value: string) => void
}

export function MentionTextarea({
  agents,
  value,
  onChange,
  onKeyDown,
  className,
  ...props
}: MentionTextareaProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const [showDropdown, setShowDropdown] = React.useState(false)
  const [mentionQuery, setMentionQuery] = React.useState("")
  const [mentionStart, setMentionStart] = React.useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  const filteredAgents = React.useMemo(() => {
    if (!mentionQuery) return agents
    const query = mentionQuery.toLowerCase()
    return agents.filter((a) => a.name.toLowerCase().includes(query))
  }, [agents, mentionQuery])

  // Reset selection when filtered list changes
  React.useEffect(() => {
    setSelectedIndex(0)
  }, [filteredAgents.length])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart

    onChange(newValue)

    // Check for @ mention trigger
    const textBeforeCursor = newValue.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf("@")

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1)
      // Only show dropdown if @ is at start or preceded by a boundary, and there's no whitespace after @.
      // This allows markdown like "**@product-lead**" to still trigger mentions.
      const charBeforeAt = lastAtIndex > 0 ? newValue[lastAtIndex - 1] : ""
      const boundaryBeforeAt =
        lastAtIndex === 0 ||
        /\s/.test(charBeforeAt) ||
        /[()[\]{}<>"'.,:;!?*_~]/.test(charBeforeAt)
      if (boundaryBeforeAt && !/\s/.test(textAfterAt)) {
        setShowDropdown(true)
        setMentionStart(lastAtIndex)
        setMentionQuery(textAfterAt)
        return
      }
    }

    setShowDropdown(false)
    setMentionStart(null)
    setMentionQuery("")
  }

  const insertMention = (agent: AgentSummary) => {
    if (mentionStart === null) return

    const before = value.slice(0, mentionStart)
    const after = value.slice(mentionStart + 1 + mentionQuery.length)
    const newValue = `${before}@${agent.name} ${after}`

    onChange(newValue)
    setShowDropdown(false)
    setMentionStart(null)
    setMentionQuery("")

    // Focus and set cursor position after the inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStart + agent.name.length + 2 // +2 for @ and space
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filteredAgents.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filteredAgents.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filteredAgents.length) % filteredAgents.length)
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        insertMention(filteredAgents[selectedIndex])
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setShowDropdown(false)
        return
      }
    }

    onKeyDown?.(e)
  }

  return (
    <div className="relative flex-1">
      <textarea
        ref={textareaRef}
        data-slot="textarea"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={cn(
          "border-input bg-input/20 dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 resize-none rounded-md border px-2 py-2 text-sm transition-colors focus-visible:ring-2 aria-invalid:ring-2 md:text-xs/relaxed placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      {showDropdown && filteredAgents.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 mb-1 w-48 rounded-md border bg-popover p-1 shadow-md z-50"
        >
          {filteredAgents.map((agent, index) => (
            <button
              key={agent.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
              onClick={() => insertMention(agent)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: agent.color }}
              />
              <span className="truncate">{agent.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
