import { create } from "zustand"
import type {
  Room,
  Agent,
  Message,
  Artifact,
  Task,
  Notification,
} from "@/lib/types"

// ─── Room Store ────────────────────────────────────────────

interface RoomStore {
  rooms: Room[]
  activeRoomId: string | null
  setActiveRoom: (id: string | null) => void
  fetchRooms: () => Promise<void>
  refreshRoom: (roomId: string) => Promise<void>
  createRoom: (name: string, description?: string, agentIds?: string[]) => Promise<Room>
  updateRoomAgents: (roomId: string, agentIds: string[]) => Promise<Room>
  updateRoomDescription: (roomId: string, description: string) => Promise<Room>
  deleteRoom: (id: string) => Promise<void>
}

export const useRoomStore = create<RoomStore>((set) => ({
  rooms: [],
  activeRoomId: null,
  setActiveRoom: (id) => set({ activeRoomId: id }),
  fetchRooms: async () => {
    const res = await fetch("/api/rooms")
    const rooms = await res.json()
    set({ rooms })
  },
  refreshRoom: async (roomId) => {
    const res = await fetch(`/api/rooms/${roomId}`)
    if (!res.ok) return
    const room = await res.json()
    set((s) => ({ rooms: s.rooms.map((r) => (r.id === roomId ? room : r)) }))
  },
  createRoom: async (name, description = "", agentIds = []) => {
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, agentIds }),
    })
    const room = await res.json()
    set((s) => ({
      rooms: s.rooms.some((r) => r.id === room.id) ? s.rooms : [...s.rooms, room],
    }))
    return room
  },
  updateRoomAgents: async (roomId, agentIds) => {
    const res = await fetch(`/api/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentIds }),
    })
    const room = await res.json()
    set((s) => ({ rooms: s.rooms.map((r) => (r.id === roomId ? room : r)) }))
    return room
  },
  updateRoomDescription: async (roomId, description) => {
    const res = await fetch(`/api/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    })
    const room = await res.json()
    set((s) => ({ rooms: s.rooms.map((r) => (r.id === roomId ? room : r)) }))
    return room
  },
  deleteRoom: async (id) => {
    await fetch(`/api/rooms/${id}`, { method: "DELETE" })
    set((s) => ({
      rooms: s.rooms.filter((r) => r.id !== id),
      activeRoomId: s.activeRoomId === id ? null : s.activeRoomId,
    }))
  },
}))

// ─── Agent Store ───────────────────────────────────────────

interface AgentStore {
  agents: Agent[]
  fetchAgents: () => Promise<void>
  createAgent: (data: Partial<Agent>) => Promise<Agent>
  updateAgent: (id: string, data: Partial<Agent>) => Promise<Agent>
  deleteAgent: (id: string) => Promise<void>
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  fetchAgents: async () => {
    const res = await fetch("/api/agents")
    const agents = await res.json()
    set({ agents })
  },
  createAgent: async (data) => {
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const agent = await res.json()
    set((s) => ({
      agents: s.agents.some((a) => a.id === agent.id) ? s.agents : [...s.agents, agent],
    }))
    return agent
  },
  updateAgent: async (id, data) => {
    const res = await fetch(`/api/agents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const agent = await res.json()
    set((s) => ({ agents: s.agents.map((a) => (a.id === id ? agent : a)) }))
    return agent
  },
  deleteAgent: async (id) => {
    await fetch(`/api/agents/${id}`, { method: "DELETE" })
    set((s) => ({ agents: s.agents.filter((a) => a.id !== id) }))
  },
}))

// ─── Message Store ─────────────────────────────────────────

interface MessageStore {
  messagesByRoom: Record<string, Message[]>
  fetchMessages: (roomId: string) => Promise<void>
  sendMessage: (roomId: string, content: string) => Promise<Message>
  appendMessage: (roomId: string, message: Message) => void
}

export const useMessageStore = create<MessageStore>((set) => ({
  messagesByRoom: {},
  fetchMessages: async (roomId) => {
    const res = await fetch(`/api/messages?roomId=${roomId}`)
    const messages = await res.json()
    set((s) => ({ messagesByRoom: { ...s.messagesByRoom, [roomId]: messages } }))
  },
  sendMessage: async (roomId, content) => {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, content, authorType: "human" }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(err.error ?? `Failed to send message (${res.status})`)
    }
    const message = await res.json()
    set((s) => {
      const existing = s.messagesByRoom[roomId] || []
      if (existing.some((m) => m.id === message.id)) {
        return s
      }
      return {
        messagesByRoom: {
          ...s.messagesByRoom,
          [roomId]: [...existing, message],
        },
      }
    })
    return message
  },
  appendMessage: (roomId, message) =>
    set((s) => {
      const existing = s.messagesByRoom[roomId] || []
      const idx = existing.findIndex((m) => m.id === message.id)
      // If we already have this message, treat incoming as an update.
      if (idx !== -1) {
        const updated = [...existing]
        updated[idx] = { ...existing[idx], ...message }
        return {
          messagesByRoom: {
            ...s.messagesByRoom,
            [roomId]: updated,
          },
        }
      }
      return {
        messagesByRoom: {
          ...s.messagesByRoom,
          [roomId]: [...existing, message],
        },
      }
    }),
}))

// ─── Artifact Store ────────────────────────────────────────

interface ArtifactStore {
  artifactsByRoom: Record<string, Artifact[]>
  fetchArtifacts: (roomId: string) => Promise<void>
  createArtifact: (data: Partial<Artifact> & { roomId: string; type: string; title: string }) => Promise<Artifact>
}

export const useArtifactStore = create<ArtifactStore>((set) => ({
  artifactsByRoom: {},
  fetchArtifacts: async (roomId) => {
    const res = await fetch(`/api/artifacts?roomId=${roomId}`)
    const artifacts = await res.json()
    set((s) => ({ artifactsByRoom: { ...s.artifactsByRoom, [roomId]: artifacts } }))
  },
  createArtifact: async (data) => {
    const res = await fetch("/api/artifacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const artifact = await res.json()
    set((s) => {
      const existing = s.artifactsByRoom[data.roomId] || []
      if (existing.some((a) => a.id === artifact.id)) return s
      return { artifactsByRoom: { ...s.artifactsByRoom, [data.roomId]: [...existing, artifact] } }
    })
    return artifact
  },
}))

// ─── Task Store ────────────────────────────────────────────

interface TaskStore {
  tasksByRoom: Record<string, Task[]>
  fetchTasks: (roomId: string) => Promise<void>
  createTask: (data: { roomId: string; title: string; description?: string; status?: string; priority?: string; assigneeId?: string }) => Promise<Task>
  updateTask: (id: string, data: Partial<Pick<Task, "title" | "description" | "status" | "priority" | "assigneeId">>) => Promise<Task>
  deleteTask: (id: string, roomId: string) => Promise<void>
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasksByRoom: {},
  fetchTasks: async (roomId) => {
    const res = await fetch(`/api/tasks?roomId=${roomId}`)
    if (!res.ok) return
    const tasks = await res.json()
    if (!Array.isArray(tasks)) return
    set((s) => ({ tasksByRoom: { ...s.tasksByRoom, [roomId]: tasks } }))
  },
  createTask: async (data) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const task = await res.json()
    set((s) => {
      const existing = s.tasksByRoom[data.roomId] || []
      if (existing.some((t) => t.id === task.id)) return s
      return {
        tasksByRoom: {
          ...s.tasksByRoom,
          [data.roomId]: [...existing, task],
        },
      }
    })
    return task
  },
  updateTask: async (id, data) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const task = await res.json()
    set((s) => {
      const updated: Record<string, Task[]> = {}
      for (const [roomId, tasks] of Object.entries(s.tasksByRoom)) {
        updated[roomId] = tasks.map((t) => (t.id === id ? task : t))
      }
      return { tasksByRoom: updated }
    })
    return task
  },
  deleteTask: async (id, roomId) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" })
    set((s) => ({
      tasksByRoom: {
        ...s.tasksByRoom,
        [roomId]: (s.tasksByRoom[roomId] || []).filter((t) => t.id !== id),
      },
    }))
  },
}))

// ─── Notification Store ────────────────────────────────────

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  fetchNotifications: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  fetchNotifications: async () => {
    const res = await fetch("/api/notifications")
    const notifications = await res.json()
    set({
      notifications,
      unreadCount: notifications.filter((n: Notification) => !n.read).length,
    })
  },
  markAsRead: async (id) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" })
    set((s) => {
      const notifications = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      }
    })
  },
  markAllAsRead: async () => {
    await fetch("/api/notifications/read-all", { method: "POST" })
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }))
  },
  deleteNotification: async (id) => {
    await fetch(`/api/notifications/${id}`, { method: "DELETE" })
    set((s) => {
      const notifications = s.notifications.filter((n) => n.id !== id)
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      }
    })
  },
}))

// ─── Settings Store ────────────────────────────────────────

interface SettingsStore {
  settings: Record<string, string>
  fetchSettings: () => Promise<void>
  updateSetting: (key: string, value: string) => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: {},
  fetchSettings: async () => {
    const res = await fetch("/api/settings")
    const settings = await res.json()
    set({ settings })
  },
  updateSetting: async (key, value) => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    })
    set((s) => ({ settings: { ...s.settings, [key]: value } }))
  },
}))
