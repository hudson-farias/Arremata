"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Gavel, Landmark, Link2, Lock, Shield, ShieldCheck } from "lucide-react"

import { OpenBids, type OpenBidsState } from "@/components/auth/open-bids"
import type { LotSummary, OpenLotsPayload } from "@/components/auth/live-lot"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { cn } from "@/lib/utils"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"

const seals = [
  { icon: ShieldCheck, title: "Autenticidade", detail: "Vitalícia" },
  { icon: Landmark, title: "Custódia", detail: "Assegurada" },
  { icon: Link2, title: "Lances", detail: "Criptografados" },
]

const footerLinks = [
  "Termos do pregão",
  "Certificação PSA & BGS",
  "Relatórios de condição",
  "Protocolos de custódia blindada",
]

function viewOf(payload: OpenLotsPayload): { lots: LotSummary[]; state: Exclude<OpenBidsState, "loading"> } {
  if (!payload.ok) return { lots: [], state: "error" }
  if (payload.lots.length === 0) return { lots: [], state: "empty" }
  return { lots: payload.lots, state: "ready" }
}

function SealRow() {
  return (
    <ul className="grid grid-cols-3 gap-3">
      {seals.map((seal) => {
        const Icon = seal.icon
        return (
          <li key={seal.title} className="flex items-center gap-2 rounded-[4px] border border-border bg-card px-3 py-3">
            <Icon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="text-[0.65rem] leading-tight tracking-[0.08em] uppercase">
              <span className="block">{seal.title}</span>
              <span className="block text-muted-foreground">{seal.detail}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export default function AuthLayoutClient({
  children,
  initialLots,
  loadOpenLots,
}: {
  children: ReactNode
  initialLots: OpenLotsPayload
  loadOpenLots: () => Promise<OpenLotsPayload>
}) {
  const pathname = usePathname()
  const initial = viewOf(initialLots)
  const [lots, setLots] = useState(initial.lots)
  const [state, setState] = useState<OpenBidsState>(initial.state)
  const skipReload = useRef(true)

  useEffect(() => {
    if (skipReload.current) {
      skipReload.current = false
      return
    }

    let active = true
    setState("loading")

    loadOpenLots()
      .then((next) => {
        if (!active) return
        const view = viewOf(next)
        setLots(view.lots)
        setState(view.state)
      })
      .catch(() => {
        if (!active) return
        setLots([])
        setState("error")
      })

    return () => {
      active = false
    }
  }, [pathname, loadOpenLots])

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary),transparent_55%)] opacity-[0.07]"
      />

      <header className="relative border-b border-border">
        <div className="mx-auto flex max-w-6xl items-start gap-4 px-6 py-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-6 gap-y-3 text-[0.65rem] tracking-[0.14em] uppercase">
            <p className="flex items-start gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <span>Sessão de leilão fechada: pregão privado</span>
            </p>
            <p>
              Custódia segura: protocolo Brink&apos;s
              <span className="mt-1 block text-muted-foreground">Genebra</span>
            </p>
            <p>
              Ref. criptográfica
              <span className="mt-1 block text-primary">Canal auditado</span>
            </p>
            <p className="flex items-start gap-2">
              <Shield className="mt-0.5 size-3.5 text-primary" aria-hidden />
              <span>
                TLS 1.3
                <span className="mt-1 block text-muted-foreground">Arquivístico</span>
              </span>
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="relative mx-auto grid w-full max-w-6xl flex-1 items-stretch gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="flex h-full flex-col gap-6">
          <OpenBids state={state} lots={lots} />
          <div className="mt-auto">
            <SealRow />
          </div>
        </div>

        <section className="flex h-full flex-col justify-center gap-8 rounded-[4px] border border-border bg-card px-8 py-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-[4px] border border-primary/50 text-primary">
              <Gavel className="size-6" aria-hidden />
            </div>
            <h1 className={cn(displayFont, "text-4xl tracking-[0.18em] text-primary")}>ARREMATA</h1>
            <p className="max-w-xs text-[0.68rem] tracking-[0.16em] text-muted-foreground uppercase">
              Casa de leilões de cartas raras e TCG
            </p>
            <div className="h-px w-16 bg-primary" aria-hidden />
            <p className="text-[0.68rem] tracking-[0.2em] text-primary uppercase">Acesso restrito ao pregão</p>
          </div>

          {children}

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border pt-4 text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
            <p className="inline-flex items-center gap-1.5">
              <Lock className="size-3" aria-hidden />
              Canal auditado ISO 27001
            </p>
            <p>Sistema de lances v4.8</p>
          </div>
        </section>
      </div>

      <footer className="relative mt-auto flex flex-col items-center gap-3 border-t border-border px-6 py-8 text-center text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          {footerLinks.map((item, index) => (
            <span key={item} className="inline-flex items-center gap-3">
              {index > 0 ? <span aria-hidden>·</span> : null}
              {item}
            </span>
          ))}
        </p>
        <p>Privacidade e compliance</p>
        <p className="max-w-3xl normal-case tracking-normal">
          © 2026 Arremata Auction House — autenticidade arquivística e alta custódia Pokémon TCG. Todos os direitos
          reservados.
        </p>
      </footer>
    </div>
  )
}
