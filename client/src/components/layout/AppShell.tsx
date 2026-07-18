import { Outlet } from "react-router"
import { TabNav } from "./TabNav"
import { ReceiptBar } from "./ReceiptBar"

const TABS = [
  { to: "/", label: "Home" },
  { to: "/e1", label: "E1: OCR" },
  { to: "/e2", label: "E2: Direct Policy" },
  { to: "/e3", label: "E3: Structured CoT" },
  { to: "/e4", label: "E4: Context" },
  { to: "/e5", label: "E5: Uncertainty" },
  { to: "/e6", label: "E6: Adversarial" },
  { to: "/annotate", label: "Annotate" },
  { to: "/policy-editor", label: "Policy Editor" },
  { to: "/settings", label: "Settings" },
]

export function AppShell() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="app-header">
        <div className="app-header__inner">
          <a href="/" className="flex items-center no-underline">
            <img src="/jblogo.png" alt="Jambutty" className="app-header__logo" />
          </a>
        </div>
      </header>
      <TabNav tabs={TABS} />
      <ReceiptBar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
