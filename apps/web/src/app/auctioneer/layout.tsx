import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { API } from "@/api/server"

export default async function AuctioneerLayout({ children }: { children: ReactNode }) {
  const signedIn = (await API.isAuthenticated()) && (await API.verifyAuthenticated())

  if (!signedIn) {
    redirect("/login?next=/auctioneer")
  }

  return children
}
