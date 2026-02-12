"use client"

import * as React from "react"
import {
  FileTextIcon,
  GitPullRequestIcon,
  NotepadIcon,
  TableIcon,
  ArrowSquareOutIcon,
} from "@phosphor-icons/react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useArtifactStore } from "@/lib/stores"
import type { Artifact, ArtifactType } from "@/lib/types"
type ArtifactIcon = React.ComponentType<{ className?: string }>

const typeConfig: Record<ArtifactType, { label: string; icon: ArtifactIcon }> = {
  plan: { label: "Plans", icon: NotepadIcon },
  pr: { label: "PRs", icon: GitPullRequestIcon },
  document: { label: "Documents", icon: FileTextIcon },
  sheet: { label: "Sheets", icon: TableIcon },
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const config = typeConfig[artifact.type as ArtifactType]
  const Icon = config?.icon ?? FileTextIcon
  const ownerName = artifact.agent?.name ?? (artifact.createdBy ? "Unknown agent" : "You")
  const ownerColor = artifact.agent?.color

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50 transition-colors cursor-pointer">
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
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowSquareOutIcon className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  )
}

function ArtifactSection({ type, artifacts }: { type: ArtifactType; artifacts: Artifact[] }) {
  const config = typeConfig[type]
  if (artifacts.length === 0) return null

  return (
    <div>
      <h3 className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {config.label}
      </h3>
      <div className="space-y-1 px-4">
        {artifacts.map((a) => (
          <ArtifactCard key={a.id} artifact={a} />
        ))}
      </div>
    </div>
  )
}

export function ArtifactsPanel({ roomId }: { roomId: string }) {
  const { artifactsByRoom, fetchArtifacts } = useArtifactStore()
  const artifacts = artifactsByRoom[roomId] || []

  React.useEffect(() => {
    fetchArtifacts(roomId)
  }, [roomId, fetchArtifacts])

  const grouped = React.useMemo(() => {
    const groups: Record<string, Artifact[]> = { plan: [], pr: [], document: [], sheet: [] }
    for (const a of artifacts) {
      if (groups[a.type]) groups[a.type].push(a)
    }
    return groups
  }, [artifacts])

  return (
    <ScrollArea className="h-full">
      <div className="py-4 space-y-4">
        {artifacts.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No artifacts yet.
          </div>
        ) : (
          <>
            <ArtifactSection type="plan" artifacts={grouped.plan} />
            {grouped.plan.length > 0 && grouped.pr.length > 0 && (
              <Separator className="mx-4" />
            )}
            <ArtifactSection type="pr" artifacts={grouped.pr} />
            {(grouped.plan.length > 0 || grouped.pr.length > 0) &&
              (grouped.document.length > 0 || grouped.sheet.length > 0) && (
                <Separator className="mx-4" />
              )}
            <ArtifactSection type="document" artifacts={grouped.document} />
            <ArtifactSection type="sheet" artifacts={grouped.sheet} />
          </>
        )}
      </div>
    </ScrollArea>
  )
}
