import { DepositDialog } from "@/components/site/deposit-dialog"
import type { Wallet } from "@/components/site/wallet"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCents } from "@/lib/money"
import { cn } from "@/lib/utils"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"
const labelClass = "text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase"

const movements = [
  {
    title: "Depósito",
    detail: "O valor entra no saldo total na hora. É um crédito simulado, sem cobrança.",
  },
  {
    title: "Lance na frente",
    detail: "Enquanto você lidera um lote ao vivo, o valor do lance fica comprometido e sai do disponível.",
  },
  {
    title: "Cobertura e arremate",
    detail: "Se alguém cobre o lance, o valor volta ao disponível na hora. No arremate, sai do saldo total.",
  },
]

export function WalletBoard({ wallet }: { wallet: Wallet }) {
  const balances = [
    {
      label: "Disponível",
      cents: wallet.available,
      detail: "É o que ainda pode ir para um lance.",
    },
    {
      label: "Comprometido",
      cents: wallet.committed,
      detail:
        wallet.committed > 0
          ? "Reservado nos lotes ao vivo em que você lidera."
          : "Nenhum lance seu está na frente agora.",
    },
    {
      label: "Saldo total",
      cents: wallet.total,
      detail: "Inclui o que está livre e o que está reservado.",
    },
  ]

  return (
    <>
      <header className="flex flex-col gap-4">
        <p className="text-[0.7rem] tracking-[0.16em] text-primary uppercase">Saldo simulado</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-2xl flex-col gap-2">
            <h1 className={cn(displayFont, "text-3xl leading-tight tracking-tight text-foreground sm:text-4xl")}>
              Carteira
            </h1>
            <p className="text-sm text-muted-foreground">
              Disponível é o saldo total menos o comprometido. O depósito credita o total; liderar um lote reserva o
              lance.
            </p>
          </div>
          <DepositDialog />
        </div>
      </header>

      <section aria-label="Saldos" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {balances.map((item) => (
          <Card key={item.label} className="rounded-[4px]">
            <CardHeader>
              <CardDescription className={labelClass}>{item.label}</CardDescription>
              <CardTitle>
                <p className="font-mono text-3xl text-primary">{formatCents(item.cents)}</p>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-[4px]">
        <CardHeader>
          <CardTitle>
            <h2 className={cn(displayFont, "text-2xl tracking-tight text-foreground")}>Como o saldo se move</h2>
          </CardTitle>
          <CardDescription>Do depósito ao martelo, sem sair desta conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {movements.map((item) => (
              <li key={item.title} className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
