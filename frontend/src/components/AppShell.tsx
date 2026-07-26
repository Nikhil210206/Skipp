"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/context/SessionContext";
import BottomNav from "./BottomNav";
import PullToRefresh from "./PullToRefresh";
import { Skeleton } from "./ui";

// The frame every authenticated screen sits in: auth guard, a header that
// scrolls away with the content, pull to refresh, and the tab bar.

export default function AppShell({
  eyebrow,
  title,
  action,
  children,
}: {
  /** Small line above the title. Use for context, not decoration. */
  eyebrow?: string;
  title: string;
  /** Optional trailing control in the header. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthed, restoring, displayName, refresh } = useSession();

  useEffect(() => {
    if (!restoring && !isAuthed) router.replace("/");
  }, [isAuthed, restoring, router]);

  // Restore renders the real layout in outline rather than a centred spinner,
  // so the page does not jump when content arrives.
  if (restoring) {
    return (
      <div
        className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col md:border-x md:border-line-soft"
        aria-busy="true"
        aria-label="Loading your data"
      >
        <div className="px-[var(--gutter)] pb-6 pt-[max(28px,calc(env(safe-area-inset-top)+12px))]">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-44" />
        </div>
        <div className="flex flex-1 flex-col gap-3 px-[var(--gutter)]">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
        <BottomNav />
      </div>
    );
  }
  if (!isAuthed) return null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col md:border-x md:border-line-soft">
      <PullToRefresh onRefresh={refresh}>
        <header className="flex items-end justify-between px-[var(--gutter)] pb-6 pt-[max(28px,calc(env(safe-area-inset-top)+12px))]">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-label uppercase text-text-3">{eyebrow}</p>
            )}
            <h1 className="mt-1.5 truncate text-title">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 pb-0.5">
            {action}
            {pathname !== "/profile" && <ProfileButton name={displayName} />}
          </div>
        </header>
        <main className="flex flex-1 flex-col px-[var(--gutter)] pb-8">{children}</main>
      </PullToRefresh>
      <BottomNav />
    </div>
  );
}

function ProfileButton({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? "s").toUpperCase();
  return (
    <Link
      href="/profile"
      aria-label="Your profile"
      className="flex size-11 items-center justify-center rounded-full border border-line bg-ink-1 text-callout font-semibold text-text-2 transition-colors hover:text-text-1"
    >
      {initial}
    </Link>
  );
}
