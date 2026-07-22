"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/context/SessionContext";
import BottomNav from "./BottomNav";

// Wraps the authenticated pages: redirects to login if there's no session,
// renders a header (student + logout) and the bottom navigation.

export default function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthed, student, logout } = useSession();

  useEffect(() => {
    if (!isAuthed) router.replace("/");
  }, [isAuthed, router]);

  if (!isAuthed) return null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col">
      <header className="flex items-center justify-between px-5 pb-3 pt-6">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight lowercase">
            {title}
          </h1>
          {student?.name && (
            <p className="text-xs text-text-muted">
              {student.name.split(" ")[0]} · {student.section ?? student.program}
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
          Log out
        </button>
      </header>
      <main className="flex flex-1 flex-col px-4">{children}</main>
      <BottomNav />
    </div>
  );
}
