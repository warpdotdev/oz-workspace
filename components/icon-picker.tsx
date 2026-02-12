"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { AGENT_ICONS, AGENT_ICON_OPTIONS } from "@/components/agent-icon"

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
  className?: string
}

export function IconPicker({ value, onChange, className }: IconPickerProps) {
  return (
    <div className={cn("grid grid-cols-8 gap-1.5", className)}>
      {AGENT_ICON_OPTIONS.map((iconKey) => {
        const IconComponent = AGENT_ICONS[iconKey]
        const isSelected = value === iconKey
        return (
          <button
            key={iconKey}
            type="button"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
              isSelected
                ? "border-foreground bg-accent"
                : "border-transparent hover:bg-accent/50"
            )}
            onClick={() => onChange(iconKey)}
            title={iconKey}
          >
            <IconComponent className="h-4 w-4" />
          </button>
        )
      })}
    </div>
  )
}
