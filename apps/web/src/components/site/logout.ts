"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function logout() {
  const jar = await cookies()
  jar.set("TOKEN", "", { path: "/", maxAge: 0 })
  jar.set("ISAUTH", "", { path: "/", maxAge: 0 })
  redirect("/login")
}
