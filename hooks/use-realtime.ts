"use client"

import { useEffect, useRef, useCallback } from "react"
import { useMessageStore, useRoomStore, useTaskStore, useArtifactStore } from "@/lib/stores"
import type { Message, Room, Task } from "@/lib/types"

interface TaskEventData {
  action: "created" | "updated" | "deleted"
  task?: Task
  taskId?: string
}

export function useRealtime(roomId: string | null) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const watchdogIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastEventIdRef = useRef<string | null>(null)
  const lastHeardAtRef = useRef<number>(0)
  const lastRoomIdRef = useRef<string | null>(null)
  const connectRef = useRef<(() => void) | null>(null)
  const { appendMessage, fetchMessages } = useMessageStore()
  const { refreshRoom } = useRoomStore()
  const { fetchTasks } = useTaskStore()
  const { fetchArtifacts } = useArtifactStore()

  const connect = useCallback(() => {
    if (!roomId) return

    // If we navigated to a different room, drop any previous cursor.
    if (lastRoomIdRef.current !== roomId) {
      lastRoomIdRef.current = roomId
      lastEventIdRef.current = null
    }

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current)
      watchdogIntervalRef.current = null
    }

    const cursor = lastEventIdRef.current
    const url = cursor
      ? `/api/events?roomId=${roomId}&cursor=${encodeURIComponent(cursor)}`
      : `/api/events?roomId=${roomId}`

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource
    lastHeardAtRef.current = Date.now()

    eventSource.addEventListener("message", (event) => {
      try {
        const evt = event as MessageEvent
        if (evt.lastEventId) lastEventIdRef.current = evt.lastEventId
        lastHeardAtRef.current = Date.now()
        const message = JSON.parse(evt.data) as Message
        appendMessage(roomId, message)
      } catch (error) {
        console.error("[useRealtime] Failed to parse message event:", error)
      }
    })

    eventSource.addEventListener("room", (event) => {
      try {
        const evt = event as MessageEvent
        if (evt.lastEventId) lastEventIdRef.current = evt.lastEventId
        lastHeardAtRef.current = Date.now()
        JSON.parse(evt.data) as Room // Validate payload
        // Update room in store - refreshRoom fetches from server
        refreshRoom(roomId)
      } catch (error) {
        console.error("[useRealtime] Failed to parse room event:", error)
      }
    })

    eventSource.addEventListener("task", (event) => {
      try {
        const evt = event as MessageEvent
        if (evt.lastEventId) lastEventIdRef.current = evt.lastEventId
        lastHeardAtRef.current = Date.now()
        JSON.parse(evt.data) as TaskEventData // Validate payload
        // For task events, refetch the full task list for simplicity
        fetchTasks(roomId)
      } catch (error) {
        console.error("[useRealtime] Failed to parse task event:", error)
      }
    })

    eventSource.addEventListener("artifact", (event) => {
      try {
        const evt = event as MessageEvent
        if (evt.lastEventId) lastEventIdRef.current = evt.lastEventId
        lastHeardAtRef.current = Date.now()
        // Refetch artifacts for this room
        fetchArtifacts(roomId)
      } catch (error) {
        console.error("[useRealtime] Failed to parse artifact event:", error)
      }
    })
    eventSource.addEventListener("heartbeat", () => {
      lastHeardAtRef.current = Date.now()
    })

    // If we stop hearing anything (including heartbeat events), assume the stream is stale
    // and force a reconnect. This handles cases where the connection is half-open and
    // the browser doesn't reliably fire `onerror`.
    watchdogIntervalRef.current = setInterval(() => {
      const msSinceHeard = Date.now() - lastHeardAtRef.current
      if (msSinceHeard < 45_000) return

      console.warn(`[useRealtime] SSE stalled (${msSinceHeard}ms since last event), reconnecting...`)
      try { eventSource.close() } catch { /* ignore */ }
      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current = null
      }
      connectRef.current?.()
    }, 15_000)

    eventSource.onerror = () => {
      console.warn("[useRealtime] Connection error, will reconnect...")
      eventSource.close()
      eventSourceRef.current = null
      lastHeardAtRef.current = 0

      // Reconnect after 3 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        connectRef.current?.()
      }, 3000)
    }

    eventSource.onopen = () => {
      console.log("[useRealtime] Connected to SSE")
      lastHeardAtRef.current = Date.now()
      // Fetch initial data on connect
      fetchMessages(roomId)
      refreshRoom(roomId)
      fetchTasks(roomId)
      fetchArtifacts(roomId)
    }
  }, [roomId, appendMessage, refreshRoom, fetchTasks, fetchMessages, fetchArtifacts])

  useEffect(() => {
    connectRef.current = connect
    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (watchdogIntervalRef.current) {
        clearInterval(watchdogIntervalRef.current)
        watchdogIntervalRef.current = null
      }
    }
  }, [connect])
}
