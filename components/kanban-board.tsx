"use client"

import * as React from "react"
import {
  PlusIcon,
  DotsSixVerticalIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EqualsIcon,
  type IconProps,
} from "@phosphor-icons/react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AgentIcon } from "@/components/agent-icon"
import { useTaskStore } from "@/lib/stores"
import type { Task, TaskStatus, TaskPriority } from "@/lib/types"

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "in_progress", label: "In Progress" },
  { status: "done", label: "Done" },
]

type PhosphorIcon = React.ComponentType<IconProps>

const priorityConfig: Record<TaskPriority, { label: string; icon: PhosphorIcon; color: string }> = {
  high: { label: "High", icon: ArrowUpIcon, color: "text-red-500" },
  medium: { label: "Med", icon: EqualsIcon, color: "text-yellow-500" },
  low: { label: "Low", icon: ArrowDownIcon, color: "text-blue-500" },
}

function TaskCard({
  task,
  onUpdate,
  onDelete,
}: {
  task: Task
  onUpdate: (id: string, data: Partial<Task>) => void
  onDelete: (id: string) => void
}) {
  const prio = priorityConfig[task.priority] ?? priorityConfig.medium
  const PrioIcon = prio.icon

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id)
        e.dataTransfer.effectAllowed = "move"
      }}
      className="group flex flex-col gap-1.5 rounded-md border bg-card p-2.5 text-sm shadow-xs hover:shadow-sm transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start gap-1.5">
        <DotsSixVerticalIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 mt-0.5" />
        <span className="flex-1 font-medium text-xs leading-snug">{task.title}</span>
        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
        >
          <TrashIcon className="h-3 w-3" />
        </button>
      </div>
      {task.description && (
        <p className="text-[0.6875rem] text-muted-foreground line-clamp-2 pl-5">
          {task.description}
        </p>
      )}
      <div className="flex items-center gap-1.5 pl-5">
        <Badge variant="outline" className="gap-0.5 h-4 text-[0.5625rem] px-1.5">
          <PrioIcon className={`h-2.5 w-2.5 ${prio.color}`} weight="bold" />
          {prio.label}
        </Badge>
        {task.assignee && (
          <Avatar className="h-4 w-4">
            <AvatarFallback
              style={{ backgroundColor: task.assignee.color }}
              className="text-white text-[0.5rem]"
            >
              <AgentIcon icon={task.assignee.icon} className="h-2.5 w-2.5" weight="bold" />
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  )
}

function InlineCreateTask({
  roomId,
  status,
  onCreated,
}: {
  roomId: string
  status: TaskStatus
  onCreated: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const { createTask } = useTaskStore()
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleSubmit = async () => {
    if (!title.trim()) return
    await createTask({ roomId, title: title.trim(), status })
    setTitle("")
    setOpen(false)
    onCreated()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <PlusIcon className="h-3 w-3" />
        Add task
      </button>
    )
  }

  return (
    <div className="rounded-md border p-2">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit()
          if (e.key === "Escape") { setOpen(false); setTitle("") }
        }}
        placeholder="Task title..."
        className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
      />
      <div className="flex justify-end gap-1 mt-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-5 text-[0.625rem] px-2"
          onClick={() => { setOpen(false); setTitle("") }}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-5 text-[0.625rem] px-2"
          disabled={!title.trim()}
          onClick={handleSubmit}
        >
          Add
        </Button>
      </div>
    </div>
  )
}

function KanbanColumn({
  status,
  label,
  tasks,
  roomId,
  onUpdate,
  onDelete,
  onRefresh,
}: {
  status: TaskStatus
  label: string
  tasks: Task[]
  roomId: string
  onUpdate: (id: string, data: Partial<Task>) => void
  onDelete: (id: string) => void
  onRefresh: () => void
}) {
  const [dragOver, setDragOver] = React.useState(false)

  return (
    <div
      className={`flex flex-col min-w-0 min-h-0 flex-1 rounded-lg ${dragOver ? "bg-muted/60" : "bg-muted/30"} transition-colors`}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const taskId = e.dataTransfer.getData("text/plain")
        if (taskId) onUpdate(taskId, { status })
      }}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <h3 className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </h3>
        <Badge variant="secondary" className="h-4 min-w-4 text-[0.5625rem] px-1">
          {tasks.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1 px-1.5">
        <div className="space-y-1.5 pb-1.5">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
          <InlineCreateTask roomId={roomId} status={status} onCreated={onRefresh} />
        </div>
      </ScrollArea>
    </div>
  )
}

export function KanbanBoard({ roomId }: { roomId: string }) {
  const { tasksByRoom, fetchTasks, updateTask, deleteTask } = useTaskStore()
  const tasks = tasksByRoom[roomId] || []

  React.useEffect(() => {
    fetchTasks(roomId)
  }, [roomId, fetchTasks])

  const handleUpdate = async (id: string, data: Partial<Task>) => {
    await updateTask(id, data)
  }

  const handleDelete = async (id: string) => {
    await deleteTask(id, roomId)
  }

  const handleRefresh = () => {
    fetchTasks(roomId)
  }

  const grouped = React.useMemo(() => {
    const g: Record<TaskStatus, Task[]> = { backlog: [], in_progress: [], done: [] }
    for (const t of tasks) {
      if (g[t.status]) g[t.status].push(t)
      else g.backlog.push(t)
    }
    return g
  }, [tasks])

  return (
    <div className="flex h-full gap-2 p-2">
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.status}
          status={col.status}
          label={col.label}
          tasks={grouped[col.status]}
          roomId={roomId}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onRefresh={handleRefresh}
        />
      ))}
    </div>
  )
}
