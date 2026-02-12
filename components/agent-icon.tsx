"use client"

import type { Icon } from "@phosphor-icons/react"
import {
  RobotIcon,
  BrainIcon,
  LightningIcon,
  CodeIcon,
  TerminalIcon,
  GearIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  BookOpenIcon,
  ChatCircleIcon,
  RocketIcon,
  ShieldCheckIcon,
  BugIcon,
  GitBranchIcon,
  DatabaseIcon,
  CloudIcon,
} from "@phosphor-icons/react"

export const AGENT_ICONS: Record<string, Icon> = {
  robot: RobotIcon,
  brain: BrainIcon,
  lightning: LightningIcon,
  code: CodeIcon,
  terminal: TerminalIcon,
  gear: GearIcon,
  search: MagnifyingGlassIcon,
  pencil: PencilIcon,
  book: BookOpenIcon,
  chat: ChatCircleIcon,
  rocket: RocketIcon,
  shield: ShieldCheckIcon,
  bug: BugIcon,
  git: GitBranchIcon,
  database: DatabaseIcon,
  cloud: CloudIcon,
}

export const AGENT_ICON_OPTIONS = Object.keys(AGENT_ICONS) as Array<keyof typeof AGENT_ICONS>

interface AgentIconProps {
  icon: string
  className?: string
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
}

export function AgentIcon({ icon, className, weight }: AgentIconProps) {
  const IconComponent = AGENT_ICONS[icon] ?? RobotIcon
  return <IconComponent className={className} weight={weight} />
}
