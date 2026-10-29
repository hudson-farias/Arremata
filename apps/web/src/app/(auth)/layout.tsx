"use client"

import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Gavel, Landmark, Link2, Lock, Shield, ShieldCheck } from "lucide-react"

import { API } from "@/api/client"
import { pickLiveLot, type LotSummary } from "@/components/auth/live-lot"
import { cn } from "@/lib/utils"

const authTheme = {
  colorScheme: "dark",
  "--background": "oklch(0.16 0.008 75)",
  "--foreground": "oklch(0.96 0.01 90)",
  "--card": "oklch(0.2 0.01 75)",
  "--card-foreground": "oklch(0.96 0.01 90)",
  "--popover": "oklch(0.2 0.01 75)",
  "--popover-foreground": "oklch(0.96 0.01 90)",
  "--primary": "oklch(0.86 0.14 92)",
  "--primary-foreground": "oklch(0.24 0.03 80)",
  "--secondary": "oklch(0.26 0.01 75)",
  "--secondary-foreground": "oklch(0.96 0.01 90)",
  "--muted": "oklch(0.26 0.01 75)",
  "--muted-foreground": "oklch(0.72 0.02 85)",
  "--accent": "oklch(0.3 0.02 80)",
  "--accent-foreground": "oklch(0.96 0.01 90)",
  "--destructive": "oklch(0.72 0.16 25)",
  "--border": "oklch(0.34 0.015 80)",
  "--input": "oklch(0.17 0.01 75)",
  "--ring": "oklch(0.86 0.14 92)",
} as CSSProperties

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

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

function formatCode(code: string) {
  return code.startsWith("#") ? code : `#${code}`
}

function formatRemaining(endsAt: string, now: number): string | null {
  const end = Date.parse(endsAt)
  if (Number.isNaN(end)) return null

  const diff = end - now
  if (diff <= 0) return "Encerrado"

  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`
}

function LiveLotCard({ lot }: { lot: LotSummary }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!lot.endsAt) return

    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [lot.endsAt])

  const remaining = lot.endsAt ? formatRemaining(lot.endsAt, now) : null
  const bid = lot.currentBid ?? lot.minimumBid
  const bidLabel = lot.currentBid != null ? "Lance atual" : "Lance mínimo"
  const specs = [lot.edition, lot.rarity, lot.grade].filter(Boolean)
  const copy = lot.description ?? lot.detail

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.65rem] tracking-[0.16em] uppercase">
        <span className="rounded-sm border border-primary/70 px-2 py-1 text-primary">Destaque do catálogo</span>
        {lot.grade ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-2 py-1 text-primary">
            <ShieldCheck className="size-3" aria-hidden />
            Certificado {lot.grade}
          </span>
        ) : null}
        {lot.registry ? <span className="text-muted-foreground">Registro: {lot.registry}</span> : null}
      </div>

      <article className="rounded-2xl border border-border bg-card p-4 text-card-foreground sm:p-5">
        <div className={cn("grid gap-5", lot.imageUrl && "sm:grid-cols-[11.5rem_minmax(0,1fr)]")}>
          {lot.imageUrl ? (
            <figure className="flex flex-col gap-2">
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                <img src={lot.imageUrl} alt="" className="aspect-[3/4] w-full object-cover" />
              </div>
              <figcaption className="text-center text-[0.6rem] tracking-[0.14em] text-muted-foreground uppercase">
                Custódia hermética
              </figcaption>
            </figure>
          ) : null}

          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-[0.68rem] tracking-[0.18em] text-primary uppercase">
              {lot.code ? `Lote ${formatCode(lot.code)} — pregão ao vivo` : "Pregão ao vivo"}
            </p>
            <h2 className={cn(displayFont, "text-3xl leading-tight break-words text-foreground")}>{lot.title}</h2>
            {specs.length > 0 ? <p className="text-sm text-foreground/90">{specs.join(" · ")}</p> : null}
            {copy ? <p className="text-sm leading-relaxed text-muted-foreground">{copy}</p> : null}

            {bid != null || remaining ? (
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
                {bid != null ? (
                  <p className="flex flex-col gap-1">
                    <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">{bidLabel}</span>
                    <span className="text-2xl text-primary">{brl.format(bid)}</span>
                  </p>
                ) : null}
                {remaining ? (
                  <p className="flex flex-col gap-1">
                    <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
                      Fechamento do lote
                    </span>
                    <span className="text-2xl text-primary">{remaining}</span>
                  </p>
                ) : null}
              </div>
            ) : null}

            {lot.reserveMet ? <p className="text-xs text-muted-foreground">Reserva de pregão atingida</p> : null}
            {lot.bidCount != null ? (
              <p className="text-sm text-muted-foreground">
                {lot.bidCount === 1 ? "1 lance registrado" : `${lot.bidCount} lances registrados`}
              </p>
            ) : null}

            {lot.custody || lot.provenance ? (
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-3 text-sm">
                {lot.custody ? (
                  <p className="flex flex-col gap-1">
                    <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">Custódia</span>
                    <span>{lot.custody}</span>
                  </p>
                ) : null}
                {lot.provenance ? (
                  <p className="flex flex-col gap-1">
                    <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">Proveniência</span>
                    <span>{lot.provenance}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  )
}

function SealRow() {
  return (
    <ul className="grid grid-cols-3 gap-3">
      {seals.map((seal) => {
        const Icon = seal.icon
        return (
          <li key={seal.title} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-3">
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

export default function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [lot, setLot] = useState<LotSummary | null>(null)

  useEffect(() => {
    let active = true

    async function loadLiveLot() {
      try {
        const response = await API.get("/lots", { status: "live" })
        if (!active) return
        if (!response.ok) {
          setLot(null)
          return
        }

        const payload: unknown = await response.json()
        if (!active) return
        setLot(pickLiveLot(payload))
      } catch {
        if (active) setLot(null)
      }
    }

    void loadLiveLot()

    return () => {
      active = false
    }
  }, [pathname])

  return (
    <div className="dark flex min-h-dvh flex-col bg-background text-foreground" style={authTheme}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary),transparent_55%)] opacity-[0.07]"
      />

      <header className="relative border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-x-6 gap-y-3 px-6 py-4 text-[0.65rem] tracking-[0.14em] uppercase">
          <p className="flex items-start gap-2">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            <span>
              Sessão de leilão fechada: pregão privado
              {lot?.code ? <span className="mt-1 block text-muted-foreground">{formatCode(lot.code)}</span> : null}
            </span>
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
      </header>

      <div className="relative mx-auto grid w-full max-w-6xl flex-1 items-stretch gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className={cn("flex h-full flex-col gap-6", lot ? "justify-between" : "justify-end")}>
          {lot ? <LiveLotCard lot={lot} /> : null}
          <SealRow />
        </div>

        <section className="flex h-full flex-col justify-center gap-8 rounded-2xl border border-border bg-card px-8 py-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/50 text-primary">
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
