import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { API } from "@/api/server"

import PasswordPageClient from "./page-client"

export const metadata: Metadata = {
  title: "Mudar senha — Arremata",
}

async function changePassword(
  currentPassword: string,
  password: string,
): Promise<{ status: number; detail: string | null }> {
  "use server"

  const response = await API.patch("/password", {
    current_password: currentPassword,
    password,
  })

  if (response.status === 204) return { status: response.status, detail: null }

  let detail: string | null = null

  try {
    const payload: unknown = await response.json()
    if (typeof payload === "object" && payload !== null && "detail" in payload) {
      const value = (payload as { detail?: unknown }).detail
      if (typeof value === "string") detail = value
    }
  } catch {
    detail = null
  }

  return { status: response.status, detail }
}

export default async function PasswordPage() {
  const signedIn = (await API.isAuthenticated()) && (await API.verifyAuthenticated())

  if (!signedIn) {
    redirect("/login?next=/password")
  }

  return <PasswordPageClient changePassword={changePassword} />
}
