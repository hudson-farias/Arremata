"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark =
    mounted &&
    (resolvedTheme === "dark" ||
      (resolvedTheme !== "light" && document.documentElement.classList.contains("dark")))

  function toggleTheme() {
    const darkActive =
      resolvedTheme === "dark" ||
      (resolvedTheme !== "light" && document.documentElement.classList.contains("dark"))
    setTheme(darkActive ? "light" : "dark")
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      aria-label={
        mounted
          ? isDark
            ? "Ativar modo claro"
            : "Ativar modo escuro"
          : "Alternar entre modo claro e escuro"
      }
      onClick={toggleTheme}
    >
      <Sun data-icon="inline-start" className="dark:hidden" aria-hidden />
      <Moon data-icon="inline-start" className="hidden dark:inline" aria-hidden />
      <span className="dark:hidden">Modo claro</span>
      <span className="hidden dark:inline">Modo escuro</span>
    </Button>
  )
}
