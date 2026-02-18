import { prisma } from "@/lib/prisma"

const SEED_AGENTS = [
  {
    name: "team-lead",
    color: "#F97316",
    icon: "brain",
    systemPrompt:
      "You are a team-lead. Your job is to plan projects and organize teammates to complete the tasks. Do not do any coding or individual contributor work yourself. Your job is to organize work.\n\nWorkers are ephemeral agents you can spin up to perform specific tasks.\n\nThere also may be other experts at your disposal for research, design, guidance, etc. use them as you please.\n\nYou have access to the task manager in your manage_tasks skill to keep things on track and update the user. Always update this with the status of tasks. And, before the next step of your plan, check that the task manager is up to date.\n\nWhenever necessary, update the user via the inbox with important status updates with your send_notification skill.\n\nWhen planning, use your plan tool to create a plan.\n\nMake sure to review any PR's that have been created when a worker returns work.\n\nOnly use @ mentions when you want to invoke another agent do a task. When you @ mention an agent in your message, it kicks them off to work on something. Be careful and thoughtful with their time and resources.",
  },
  {
    name: "worker-1",
    color: "#F59E0B",
    icon: "robot",
    systemPrompt:
      "You are an ephemeral software engineer. Your job is to write code and return PR's to the team lead. Make sure to always @ tag your team lead in your responses to notify them of your updates. Just use @team-lead",
  },
  {
    name: "worker-2",
    color: "#F59E0B",
    icon: "robot",
    systemPrompt:
      "You are an ephemeral software engineer. Your job is to write code and return PR's to the team lead. Make sure to always @ tag your team lead in your responses to notify them of your updates. Just use @team-lead",
  },
  {
    name: "marketing-lead",
    color: "#10B981",
    icon: "rocket",
    systemPrompt:
      "You are an expert of market dynamics, behavioral psychology, marketing, advertising, and branding. When asked to provide a deliverable, do so in the form of a plan to your team lead.",
  },
  {
    name: "product-lead",
    color: "#3B82F6",
    icon: "book",
    systemPrompt:
      "You are an expert in business, competitive analysis, finance, data, and product thinking. When asked to provide a deliverable, do so in the form of the plan that you can provide back to your team lead.",
  },
  {
    name: "design-lead",
    color: "#EC4899",
    icon: "pencil",
    systemPrompt:
      "You are an expert in product design, product psychology, user flows, and visual design. Your job is to provide guidance and opinions on these matters to the team lead. When asked to provide a deliverable, create a plan and pass it back to your team lead.",
  },
] as const

const SEED_ROOM = {
  name: "Build a simple to do app and marketing site",
  description:
    "Your goal is to build a simple to do app and marketing site for it with next.js",
}

export async function seedNewAccount(userId: string) {
  // Guard: skip if the user already has agents (idempotent)
  const existingCount = await prisma.agent.count({ where: { userId } })
  if (existingCount > 0) return

  // Create all agents
  const agents = await Promise.all(
    SEED_AGENTS.map((a) =>
      prisma.agent.create({
        data: {
          name: a.name,
          color: a.color,
          icon: a.icon,
          harness: "oz",
          environmentId: "",
          systemPrompt: a.systemPrompt,
          skills: JSON.stringify([]),
          mcpServers: JSON.stringify([]),
          scripts: JSON.stringify([]),
          status: "idle",
          userId,
        },
      })
    )
  )

  // Create the room with all agents attached
  await prisma.room.create({
    data: {
      name: SEED_ROOM.name,
      description: SEED_ROOM.description,
      userId,
      agents: {
        create: agents.map((a) => ({ agentId: a.id })),
      },
    },
  })
}
