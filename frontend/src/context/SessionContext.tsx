"use client";

// Client-side session: holds credentials in memory for the tab's lifetime and
// the student profile from login. Credentials are NOT persisted to storage yet
// — on-device AES-GCM encryption (CLAUDE.md §3) lands in Phase 3, so a refresh
// returns you to the login screen.

import { createContext, useContext, useMemo, useState } from "react";
import type { Credentials, StudentInfo, Timetable } from "@/types";
import { fetchTimetable } from "@/lib/api";

type SessionValue = {
  creds: Credentials | null;
  student: StudentInfo | null;
  timetable: Timetable | null;
  isAuthed: boolean;
  login: (creds: Credentials) => Promise<void>;
  logout: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [timetable, setTimetable] = useState<Timetable | null>(null);

  const value = useMemo<SessionValue>(
    () => ({
      creds,
      student: timetable?.student ?? null,
      timetable,
      isAuthed: creds !== null,
      async login(next) {
        // The timetable endpoint is always available, so we use it to verify
        // the credentials and grab the student profile in one shot.
        const tt = await fetchTimetable(next);
        setCreds(next);
        setTimetable(tt);
      },
      logout() {
        setCreds(null);
        setTimetable(null);
      },
    }),
    [creds, timetable],
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
