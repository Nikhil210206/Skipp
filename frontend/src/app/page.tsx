"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LoginForm from "@/components/LoginForm";
import { useSession } from "@/context/SessionContext";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthed, restoring } = useSession();

  // If an encrypted session rehydrates, skip the login screen.
  useEffect(() => {
    if (isAuthed) router.replace("/dashboard");
  }, [isAuthed, router]);

  if (restoring || isAuthed) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center">
        <div
          className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-accent"
          aria-label="Loading"
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight lowercase">skipp</h1>
        <p className="mt-2 text-text-muted">know before you bunk.</p>
      </div>

      <LoginForm />

      <p className="mt-8 max-w-sm text-center text-xs text-text-muted">
        Not affiliated with SRM. Your data is never stored on our servers. Use at
        your own risk.
      </p>
    </main>
  );
}
