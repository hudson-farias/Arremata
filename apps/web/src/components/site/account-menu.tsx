"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, Gavel, KeyRound, LayoutGrid, LogOut, Trophy, Wallet } from "lucide-react"

import { logout } from "@/components/site/logout"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AccountMenu() {
  const pathname = usePathname()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" className="rounded-[4px]">
          Conta
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/auctioneer">
              <Gavel />
              Painel do leiloeiro
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/">
              <LayoutGrid />
              Vitrine
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/password">
              <KeyRound />
              Mudar senha
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/wallet" aria-current={pathname === "/wallet" ? "page" : undefined}>
              <Wallet />
              Carteira
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/wins">
              <Trophy />
              Meus arremates
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              void logout()
            }}
          >
            <LogOut />
            Sair
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
