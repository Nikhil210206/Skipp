"use client";

// Client-side session: holds credentials in memory and the fetched timetable.
// Credentials are persisted encrypted on-device (see lib/crypto) so the session
// survives a reload; they are never stored server-side.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Credentials, StudentInfo, Timetable } from "@/types";
import { fetchTimetable } from "@/lib/api";
import {
  clearCredentials,
  loadCredentials,
  saveCredentials,
} from "@/lib/crypto";

type SessionValue = {
  creds: Credentials | null;
  student: StudentInfo | null;
  timetable: Timetable | null;
  isAuthed: boolean;
  restoring: boolean; // true while we try to rehydrate a saved session
  login: (creds: Credentials) => Promise<void>;
  logout: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [restoring, setRestoring] = useState(true);

  // On first mount, try to rehydrate an encrypted session from a prior visit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadCredentials();
      if (!saved || cancelled) {
        if (!cancelled) setRestoring(false);
        return;
      }
      try {
        const tt = await fetchTimetable(saved);
        if (!cancelled) {
          setCreds(saved);
          setTimetable(tt);
        }
      } catch {
        clearCredentials(); // stale/invalid — force a fresh login
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      creds,
      student: timetable?.student ?? null,
      timetable,
      isAuthed: creds !== null,
      restoring,
      async login(next) {
        const tt = await fetchTimetable(next);
        setCreds(next);
        setTimetable(tt);
        void saveCredentials(next);
      },
      logout() {
        setCreds(null);
        setTimetable(null);
        clearCredentials();
      },
    }),
    [creds, timetable, restoring],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
