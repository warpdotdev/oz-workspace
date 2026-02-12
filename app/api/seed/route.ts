import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId, AuthError, unauthorizedResponse } from "@/lib/auth-helper"

export async function POST() {
  try {
    const userId = await getAuthenticatedUserId()

    // Clear existing data for this user
    await prisma.notification.deleteMany({ where: { userId } })
    await prisma.artifact.deleteMany({ where: { userId } })
    await prisma.message.deleteMany({ where: { userId } })
    await prisma.task.deleteMany({ where: { userId } })
    // Delete room agents for user's rooms
    const userRoomIds = (await prisma.room.findMany({ where: { userId }, select: { id: true } })).map(r => r.id)
    if (userRoomIds.length > 0) {
      await prisma.roomAgent.deleteMany({ where: { roomId: { in: userRoomIds } } })
    }
    await prisma.room.deleteMany({ where: { userId } })
    await prisma.agent.deleteMany({ where: { userId } })

    // Create agents
    const backendLead = await prisma.agent.create({
      data: {
        name: "backend-lead",
        color: "#3B82F6",
        repoUrl: "https://github.com/acme/backend-service",
        harness: "claude-code",
        systemPrompt: "You are a senior backend engineer. Focus on API design, database optimization, and system reliability.",
        skills: JSON.stringify(["code-review", "api-design", "database"]),
        mcpServers: JSON.stringify(["github", "notion"]),
        scripts: JSON.stringify(["./scripts/test.sh"]),
        status: "idle",
        userId,
      },
    })

    const productLead = await prisma.agent.create({
      data: {
        name: "product-lead",
        color: "#F59E0B",
        repoUrl: "https://github.com/acme/product-specs",
        harness: "codex",
        systemPrompt: "You are a product manager agent. Analyze requirements, write specs, and coordinate with engineering.",
        skills: JSON.stringify(["spec-writing", "analysis"]),
        mcpServers: JSON.stringify(["notion", "jira"]),
        scripts: JSON.stringify([]),
        status: "idle",
        userId,
      },
    })

    const designLead = await prisma.agent.create({
      data: {
        name: "design-lead",
        color: "#EC4899",
        repoUrl: "https://github.com/acme/design-system",
        harness: "claude-code",
        systemPrompt: "You are a design systems engineer. Focus on component architecture, accessibility, and visual consistency.",
        skills: JSON.stringify(["component-design", "a11y"]),
        mcpServers: JSON.stringify(["figma"]),
        scripts: JSON.stringify([]),
        status: "running",
        userId,
      },
    })

    const dataLead = await prisma.agent.create({
      data: {
        name: "data-lead",
        color: "#8B5CF6",
        repoUrl: "https://github.com/acme/data-pipeline",
        harness: "gemini-cli",
        systemPrompt: "You are a data engineering agent. Focus on ETL pipelines, data quality, and analytics.",
        skills: JSON.stringify(["data-modeling", "sql", "pipeline-design"]),
        mcpServers: JSON.stringify(["bigquery"]),
        scripts: JSON.stringify(["./scripts/run-pipeline.sh"]),
        status: "idle",
        userId,
      },
    })

    // Create rooms
    const fraudRoom = await prisma.room.create({
      data: {
        name: "Fraud",
        description: "Fraud detection system development",
        userId,
        agents: { create: [{ agentId: backendLead.id }, { agentId: dataLead.id }] },
      },
    })

    const productRoom = await prisma.room.create({
      data: {
        name: "Product",
        description: "Product development and feature planning",
        userId,
        agents: { create: [{ agentId: productLead.id }, { agentId: designLead.id }] },
      },
    })

    const dataRoom = await prisma.room.create({
      data: {
        name: "Data",
        description: "Data infrastructure and pipelines",
        userId,
        agents: { create: [{ agentId: dataLead.id }, { agentId: backendLead.id }] },
      },
    })

    // Messages
    await prisma.message.createMany({
      data: [
        { roomId: fraudRoom.id, authorType: "human", content: "We need to build a real-time fraud detection pipeline. Let's start by defining the data model and the scoring algorithm.", userId, timestamp: new Date("2025-02-07T10:00:00Z") },
        { roomId: fraudRoom.id, authorId: backendLead.id, authorType: "agent", content: "I've analyzed the requirements. I suggest we use an event-driven architecture with Kafka for real-time streaming.\n\nHere's my proposed architecture:\n1. Ingestion layer (Kafka topics)\n2. Feature extraction service\n3. Scoring engine (rules + ML)\n4. Alert service", sessionUrl: "https://session.example.com/abc123", userId, timestamp: new Date("2025-02-07T10:05:00Z") },
        { roomId: fraudRoom.id, authorId: dataLead.id, authorType: "agent", content: "Good plan. I'll set up the data pipeline for feature extraction. We should define our feature set first — transaction amount, frequency, geo-location patterns, device fingerprints.", userId, timestamp: new Date("2025-02-07T10:10:00Z") },
        { roomId: fraudRoom.id, authorType: "human", content: "Great start. Let's also add velocity checks for rapid successive transactions. @backend-lead can you create a PR for the initial data model?", userId, timestamp: new Date("2025-02-07T10:15:00Z") },
        { roomId: fraudRoom.id, authorId: backendLead.id, authorType: "agent", content: "PR created with the initial schema: Transaction, FraudScore, Alert models. Added velocity check fields as requested.", sessionUrl: "https://github.com/acme/backend-service/pull/42", userId, timestamp: new Date("2025-02-07T10:25:00Z") },
        { roomId: productRoom.id, authorId: productLead.id, authorType: "agent", content: "I've drafted the Q1 feature roadmap based on customer feedback analysis. The top priorities are:\n1. Dashboard redesign\n2. API rate limiting improvements\n3. Multi-tenant support", userId, timestamp: new Date("2025-02-07T09:00:00Z") },
        { roomId: productRoom.id, authorId: designLead.id, authorType: "agent", content: "I've reviewed the dashboard redesign requirements. Prepared initial wireframes using our design system components. Key changes: collapsible sidebar, resizable panels, and a new chart library.", userId, timestamp: new Date("2025-02-07T09:15:00Z") },
      ],
    })

    // Artifacts
    await prisma.artifact.createMany({
      data: [
        { roomId: fraudRoom.id, type: "plan", title: "Fraud Detection Architecture Plan", content: "Event-driven architecture with Kafka, feature store, and ML scoring engine.", createdBy: backendLead.id, userId },
        { roomId: fraudRoom.id, type: "pr", title: "feat: initial fraud data model", url: "https://github.com/acme/backend-service/pull/42", createdBy: backendLead.id, userId },
        { roomId: fraudRoom.id, type: "document", title: "Feature Store Schema", content: "Schema definition for fraud detection features.", createdBy: dataLead.id, userId },
        { roomId: productRoom.id, type: "plan", title: "Q1 Feature Roadmap", content: "Dashboard redesign, API rate limiting, multi-tenant support.", createdBy: productLead.id, userId },
        { roomId: productRoom.id, type: "document", title: "Dashboard Wireframes", content: "Initial wireframes for the dashboard redesign.", createdBy: designLead.id, userId },
        { roomId: dataRoom.id, type: "plan", title: "Data Pipeline Migration Plan", content: "Migrate from batch to streaming with Kafka Connect.", createdBy: dataLead.id, userId },
      ],
    })

    // Notifications
    await prisma.notification.createMany({
      data: [
        { roomId: fraudRoom.id, agentId: backendLead.id, message: "PR #42 is ready for review: feat: initial fraud data model", read: false, userId },
        { roomId: fraudRoom.id, agentId: dataLead.id, message: "Feature store schema draft is ready for your input", read: false, userId },
        { roomId: productRoom.id, agentId: productLead.id, message: "Q1 roadmap draft needs your approval", read: true, userId },
      ],
    })

    return NextResponse.json({ ok: true, message: "Seed data created successfully" })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    console.error("POST /api/seed error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
