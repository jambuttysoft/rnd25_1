import { NavLink } from "react-router"

interface Tab {
  to: string
  label: string
}

export function TabNav({ tabs }: { tabs: Tab[] }) {
  return (
    <nav className="flex border-b border-border overflow-x-auto">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === "/"}
          className={({ isActive }) =>
            `inline-flex items-center gap-1 px-3 py-2 text-sm no-underline transition-colors ${
              isActive
                ? "border-b-2 border-indigo text-indigo font-medium"
                : "text-slate-500 hover:text-slate-900"
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
