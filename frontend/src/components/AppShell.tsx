"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/context/SessionContext";
import BottomNav from "./BottomNav";

// Wraps the authenticated pages: redirects to login if there's no session,
// renders a header and the bottom navigation.

export default function AppShell({
  title,
  greeting,
  children,
}: {
  title: string;
  greeting?: string; // when set, renders the friendly "sup! <name>" home header
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthed, restoring, student, logout } = useSession();

  useEffect(() => {
    if (!restoring && !isAuthed) router.replace("/");
  }, [isAuthed, restoring, router]);

  if (restoring) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center">
        <div
          className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-accent"
          aria-label="Restoring session"
        />
      </div>
    );
  }
  if (!isAuthed) return null;

  const firstName = (greeting ?? "").split(" ")[0].toLowerCase();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col">
      {greeting ? (
        <header className="flex items-center justify-between px-5 pb-4 pt-7">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-surface text-xl">
            🎓
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
              sup!
            </p>
            <p className="-mt-0.5 text-2xl font-extrabold tracking-tight">
              {firstName}
            </p>
          </div>
        </header>
      ) : (
        <header className="flex items-center justify-between px-5 pb-3 pt-7">
          <div>
            <h1 className="text-xl font-extrabold lowercase tracking-tight">
              {title}
            </h1>
            {student?.name && (
              <p className="text-xs text-text-muted">
                {student.name.split(" ")[0]} ·{" "}
                {student.section ?? student.program}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              logout();
              router.replace("/");
            }}
            className="rounded-lg px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-danger"
          >
            log out
          </button>
        </header>
      )}
      <main className="flex flex-1 flex-col px-4">{children}</main>
      <BottomNav />
    </div>
  );
}
