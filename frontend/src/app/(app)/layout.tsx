import AppShell from "@/components/AppShell";

/**
 * The signed-in frame, mounted once for every tab.
 *
 * A route group, so the URLs are untouched: `(app)/dashboard` still serves
 * `/dashboard`. What it buys is that the six screens are no longer siblings
 * under the root layout. They now share this one, so React keeps the shell
 * mounted and swaps only `children` on a navigation.
 *
 * That is the difference between a tab change costing a content render and
 * costing an entire rebuild of the chrome. Before this, every tap unmounted and
 * remounted the masthead, the tab bar and its ResizeObserver, pull to refresh
 * and its listeners, the sidebar, the profile mark, the install gate and three
 * sheets, plus their localStorage reads, on the same frames the transition
 * needed to animate. All of the module scope bookkeeping around the app
 * (`lastPlacement`, `riseAt`, `cooldownUntil`) exists to survive that remount.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
