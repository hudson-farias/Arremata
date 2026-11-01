import type { Metadata } from "next"
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { API } from "@/api/server"
import { WalletBoard } from "@/components/site/wallet-board"
import { parseWallet, type Wallet } from "@/components/site/wallet"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export const metadata: Metadata = {
  title: "Carteira — Arremata",
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

async function loadWallet(): Promise<Wallet | "unauthorized" | "error"> {
  try {
    const response = await API.get("/wallet")
    if (response.status === 401) return "unauthorized"
    if (!response.ok) return "error"

    const wallet = parseWallet(await readPayload(response))
    if (!wallet) return "error"
    return wallet
  } catch {
    return "error"
  }
}

function WalletFrame({ children }: { children: ReactNode }) {
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

export default async function WalletPage() {
  const wallet = await loadWallet()

  if (wallet === "unauthorized") {
    redirect("/login?next=/wallet")
  }

  if (wallet === "error") {
    return (
      <WalletFrame>
        <Alert variant="destructive" className="rounded-[4px]">
          <AlertTitle>Não foi possível carregar a carteira</AlertTitle>
          <AlertDescription>A página não recebeu o saldo. Tente de novo em instantes.</AlertDescription>
        </Alert>
      </WalletFrame>
    )
  }

  return (
    <WalletFrame>
      <WalletBoard wallet={wallet} />
    </WalletFrame>
  )
}
