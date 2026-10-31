import type { Metadata } from "next"
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { API } from "@/api/server"
import { WinsBoard } from "@/components/lots/wins-board"
import { parseWins, type WinsView } from "@/components/lots/wins"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Arremates — Arremata",
}

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

async function loadWins(): Promise<WinsView | "unauthorized" | "error"> {
  try {
    const response = await API.get("/wins")
    if (response.status === 401) return "unauthorized"
    if (!response.ok) return "error"

    const view = parseWins(await readPayload(response))
    if (!view) return "error"
    return view
  } catch {
    return "error"
  }
}

function WinsFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary),transparent_55%)] opacity-[0.07]"
      />

      <main className="relative mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-8 px-6 py-8 lg:px-12">
        {children}
      </main>
    </div>
  )
}

export default async function WinsPage() {
  const view = await loadWins()

  if (view === "unauthorized") {
    redirect("/login?next=/wins")
  }

  if (view === "error") {
    return (
      <WinsFrame>
        <Alert variant="destructive" className="rounded-[4px]">
          <AlertTitle>Não foi possível carregar os arremates</AlertTitle>
          <AlertDescription>A página não recebeu seus lotes. Tente de novo em instantes.</AlertDescription>
        </Alert>
      </WinsFrame>
    )
  }

  return (
    <WinsFrame>
      <WinsBoard won={view.won} bids={view.bids} />
    </WinsFrame>
  )
}
