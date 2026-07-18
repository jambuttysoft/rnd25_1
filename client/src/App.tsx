import { createBrowserRouter, RouterProvider } from "react-router"
import { AppShell } from "@/components/layout/AppShell"
import SettingsPage from "@/pages/SettingsPage"

const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      { index: true, lazy: () => import("@/pages/HomePage") },
      { path: "e1", lazy: () => import("@/pages/E1Page") },
      { path: "e2", lazy: () => import("@/pages/E2Page") },
      { path: "e3", lazy: () => import("@/pages/E3Page") },
      { path: "e4", lazy: () => import("@/pages/E4Page") },
      { path: "e5", lazy: () => import("@/pages/E5Page") },
      { path: "e6", lazy: () => import("@/pages/E6Page") },
      { path: "annotate", lazy: () => import("@/pages/AnnotatePage") },
      { path: "policy-editor", lazy: () => import("@/pages/PolicyEditorPage") },
      { path: "settings", Component: SettingsPage },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
