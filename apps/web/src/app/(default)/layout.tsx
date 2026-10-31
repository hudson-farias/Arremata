import Link from "next/link"
import { Shield } from "lucide-react"
import type { ReactNode } from "react"

import { API } from "@/api/server"
import { AccountMenu } from "@/components/site/account-menu"
import { DepositDialog } from "@/components/site/deposit-dialog"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatCents, parseCents } from "@/lib/money"
import { cn } from "@/lib/utils"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"

type Wallet = {
  total: number
  committed: number
  available: number
}

const emptyWallet: Wallet = { total: 0, committed: 0, available: 0 }

async function loadWallet(): Promise<Wallet> {
  try {
    const response = await API.get("/wallet")
    if (!response.ok) return emptyWallet

    const payload: unknown = await response.json()
    if (typeof payload !== "object" || payload === null) return emptyWallet

    const record = payload as Record<string, unknown>
    const total = parseCents(record.total)
    const committed = parseCents(record.committed)
    const available = parseCents(record.available)

    if (total == null || committed == null || available == null) return emptyWallet
    return { total, committed, available }
  } catch {
    return emptyWallet
  }
}

export default async function DefaultLayout({ children }: { children: ReactNode }) {
  const signedIn = (await API.isAuthenticated()) && (await API.verifyAuthenticated())
  const wallet = signedIn ? await loadWallet() : emptyWallet
  const balances = [
    { label: "Saldo total", cents: wallet.total },
    { label: "Comprometido", cents: wallet.committed },
    { label: "Disponível", cents: wallet.available },
  ]

  return (
    <div className="flex min-h-dvh flex-col">

      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-4 px-6 py-4 lg:px-12">
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/" className={cn(displayFont, "text-2xl tracking-tight text-primary uppercase")}>
              Arremata
            </Link>
            <Separator orientation="vertical" className="hidden h-6 w-px md:block" />
            <Badge variant="outline" className="rounded-[4px]">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
              Custódia blindada
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {signedIn ? (
              <>
                <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[4px] border border-border px-3 py-1.5">
                  {balances.map((item) => (
                    <div key={item.label} className="flex flex-col">
                      <dt className="text-[0.65rem] tracking-[0.12em] text-muted-foreground uppercase">{item.label}</dt>
                      <dd className="text-sm text-primary">{formatCents(item.cents)}</dd>
                    </div>
                  ))}
                </dl>
                <DepositDialog />
                <ThemeToggle />
                <AccountMenu />
              </>
            ) : (
              <>
                <ThemeToggle />
                <Button asChild className="rounded-[4px]">
                  <Link href="/login">Entrar</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      <footer className="relative mt-auto flex flex-col items-center gap-3 border-t border-border px-6 py-8 text-center">
        <p className="inline-flex items-center gap-2 text-sm">
          <Shield className="size-4 text-primary" aria-hidden />
          Casa de leilões de cartas raras e TCG.
        </p>
        <p className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
          © 2026 Arremata — autenticidade arquivística e alta custódia Pokémon TCG.
        </p>
      </footer>
    </div>
  )
}
