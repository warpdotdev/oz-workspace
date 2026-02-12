"use client"

import { useCallback, useEffect, useRef } from "react"

type RefreshFn = () => void

export function usePublicRealtime({
  shareId,
  refreshRoom,
  refreshMessages,
  refreshTasks,
  refreshArtifacts,
}: {
  shareId: string | null
  refreshRoom: RefreshFn
  refreshMessages: RefreshFn
  refreshTasks: RefreshFn
  refreshArtifacts: RefreshFn
}) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const watchdogIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastEventIdRef = useRef<string | null>(null)
  const lastHeardAtRef = useRef<number>(0)
  const lastShareIdRef = useRef<string | null>(null)
  const connectRef = useRef<(() => void) | null>(null)

  const connect = useCallback(() => {
    if (!shareId) return

    // If we navigated to a different share link, drop any previous cursor.
    if (lastShareIdRef.current !== shareId) {
      lastShareIdRef.current = shareId
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
      ? `/api/public/events?shareId=${encodeURIComponent(shareId)}&cursor=${encodeURIComponent(cursor)}`
      : `/api/public/events?shareId=${encodeURIComponent(shareId)}`

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource
    lastHeardAtRef.current = Date.now()

    const note = (event: Event) => {
      const evt = event as MessageEvent
      if (evt.lastEventId) lastEventIdRef.current = evt.lastEventId
      lastHeardAtRef.current = Date.now()
    }

    eventSource.addEventListener("message", (event) => {
      note(event)
      refreshMessages()
    })
    eventSource.addEventListener("room", (event) => {
      note(event)
      refreshRoom()
    })
    eventSource.addEventListener("task", (event) => {
      note(event)
      refreshTasks()
    })
    eventSource.addEventListener("artifact", (event) => {
      note(event)
      refreshArtifacts()
    })
    eventSource.addEventListener("heartbeat", () => {
      lastHeardAtRef.current = Date.now()
    })

    watchdogIntervalRef.current = setInterval(() => {
      const msSinceHeard = Date.now() - lastHeardAtRef.current
      if (msSinceHeard < 45_000) return

      console.warn(`[usePublicRealtime] SSE stalled (${msSinceHeard}ms since last event), reconnecting...`)
      try { eventSource.close() } catch { /* ignore */ }
      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current = null
      }
      connectRef.current?.()
    }, 15_000)

    eventSource.onerror = () => {
      console.warn("[usePublicRealtime] Connection error, will reconnect...")
      eventSource.close()
      eventSourceRef.current = null
      lastHeardAtRef.current = 0

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        connectRef.current?.()
      }, 3000)
    }

    eventSource.onopen = () => {
      console.log("[usePublicRealtime] Connected to SSE")
      lastHeardAtRef.current = Date.now()
      // Refresh everything on connect to resync quickly.
      refreshRoom()
      refreshMessages()
      refreshTasks()
      refreshArtifacts()
    }
  }, [shareId, refreshRoom, refreshMessages, refreshTasks, refreshArtifacts])

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

