"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/context/SessionContext";
import BottomNav from "./BottomNav";
import PullToRefresh from "./PullToRefresh";

// Wraps the authenticated pages: redirects to login if there's no session,
// renders a header (with a profile button) and the bottom navigation.

export default function AppShell({
  title,
  greeting = false,
  children,
}: {
  title: string;
  greeting?: boolean; // Home uses the friendly "sup! <name>" header
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthed, restoring, student, displayName, refresh } = useSession();

  useEffect(() => {
    if (!restoring && !isAuthed) router.replace("/");
  }, [isAuthed, restoring, router]);

  if (restoring) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center">
        <div
          className="size-8 animate-spin rounded-full border-2 border-line-strong border-t-accent"
          aria-label="Restoring session"
        />
      </div>
    );
  }
  if (!isAuthed) return null;

  const showProfileBtn = pathname !== "/profile";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col">
      <PullToRefresh onRefresh={refresh}>
        {greeting ? (
          <header className="flex items-center justify-between px-5 pb-4 pt-7">
            <div className="text-left">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                sup!
              </p>
              <p className="-mt-0.5 text-2xl font-extrabold lowercase tracking-tight">
                {displayName}
              </p>
            </div>
            {showProfileBtn && <ProfileButton name={displayName} />}
          </header>
        ) : (
          <header className="flex items-center justify-between px-5 pb-3 pt-7">
            <div>
              <h1 className="text-xl font-extrabold lowercase tracking-tight">
                {title}
              </h1>
              {student?.name && (
                <p className="text-xs text-text-muted">
                  {displayName} ·{" "}
                  {student.section ?? student.program ?? ""}
                </p>
              )}
            </div>
            {showProfileBtn && <ProfileButton name={displayName} />}
          </header>
        )}
        <main className="flex flex-1 flex-col px-4">{children}</main>
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
      aria-label="Profile"
      className="flex size-11 items-center justify-center rounded-2xl bg-accent text-lg font-extrabold text-background transition-opacity hover:opacity-90"
    >
      {initial}
    </Link>
  );
}
