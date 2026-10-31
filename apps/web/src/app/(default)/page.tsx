import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Arremata</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Next.js no front e FastAPI na API. O Postgres sobe pelo compose em infrastructure.
        </p>
      </div>
      <Button className="w-fit rounded-[4px]">Começar</Button>
    </main>
  )
}
