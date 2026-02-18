import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import Link from "next/link"
import Image from "next/image"
import { OzLogo } from "@/components/oz-logo"
import { Button } from "@/components/ui/button"
import {
  HashIcon,
  AtIcon,
  KanbanIcon,
  NotepadIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react/dist/ssr"

const screenshots = {
  hero: "/hero.png",
  rooms: "/rooms.png",
  tasks: "/kanban.png",
  createAgent: "/agents.png",
  inbox: "/inbox.png",
}

const features = [
  {
    icon: HashIcon,
    title: "Collaborative rooms",
    description:
      "Organize work by project room and let humans and agents coordinate in one shared channel. Plans, PRs, and other artifacts live right next to the conversation.",
    image: screenshots.rooms,
    imageAlt: "Oz workspace showing chat in a project room with active collaboration.",
  },
  {
    icon: AtIcon,
    title: "Agent dispatch via @mentions",
    description:
      "Create custom agents with their own roles, system prompts, and environments. Trigger them instantly by @mentioning in chat, and let agents dispatch each other to parallelize planning and execution.",
    image: screenshots.createAgent,
    imageAlt: "Create agent dialog used to configure specialized agents for team workflows.",
  },
  {
    icon: KanbanIcon,
    title: "Task execution board",
    description:
      "Track backlog, in-progress, and done work while agents update task state as they move.",
    image: screenshots.tasks,
    imageAlt: "Kanban task board with backlog, in-progress, and done columns.",
  },
  {
    icon: NotepadIcon,
    title: "Inbox notifications",
    description:
      "Get updates from agents in your inbox. Stay on top of completed tasks, PRs ready for review, and important status changes without watching the chat.",
    image: screenshots.inbox,
    imageAlt: "Inbox showing agent notifications about project progress and completed work.",
  },
]

export default async function Page() {
  const session = await auth()
  if (session?.user) {
    redirect("/home")
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <OzLogo className="h-4 w-4" />
            <span className="text-sm font-semibold tracking-tight">Oz Workspace</span>
          </Link>
          <div className="inline-flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="overflow-hidden pt-14 md:pt-24">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 md:grid-cols-[1fr_1.4fr] md:items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Multi-agent workspace
              </p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">
                Build and ship with teams of autonomous agents.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                Coordinate specialized agents in real-time rooms, track delivery in Kanban, and
                generate plans and PRs without losing context.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Button size="lg" asChild>
                  <Link href="/signup">
                    Sign up
                    <ArrowRightIcon />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            </div>
            <div className="md:-mr-[calc(50vw-50%)] md:pl-4">
              <Image
                src={screenshots.hero}
                alt="Oz workspace showing active chat and generated plan/PR artifacts."
                width={1512}
                height={853}
                className="h-auto w-full rounded-l-xl border border-r-0"
                priority
              />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4" style={{ paddingTop: '8rem' }}>
          <div className="flex flex-col" style={{ gap: '3rem' }}>
            {features.map((feature, index) => {
              const textBlock = (
                <div key="text">
                  <div className="inline-flex items-center gap-2">
                    <feature.icon className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">{feature.title}</h2>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              )
              const imageBlock = (
                <div key="image">
                  <Image
                    src={feature.image}
                    alt={feature.imageAlt}
                    width={1512}
                    height={853}
                    className={feature.imageClass ?? "h-auto w-full rounded-md border"}
                  />
                </div>
              )
              return (
                <article
                  key={feature.title}
                  className="grid gap-8 rounded-lg p-6 md:grid-cols-2 md:items-center md:p-10"
                >
                  {index % 2 === 0
                    ? [textBlock, imageBlock]
                    : [imageBlock, textBlock]}
                </article>
              )
            })}
          </div>
        </section>

        <section className="border-y bg-card/40" style={{ marginTop: '8rem', paddingBottom: '1rem' }}>
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-4 py-20 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-semibold">Start building with Oz Workspace</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your account and launch your first multi-agent room in minutes.
              </p>
            </div>
            <div className="inline-flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Sign up</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
