"use client";

// Client-side session. ONE portal login per session: on login (and on reload-
// rehydrate) we fetch the combined snapshot (timetable + attendance + marks) and
// cache it, so switching tabs never triggers another Zoho sign-in (which is
// daily-capped). Credentials are persisted encrypted on-device (lib/crypto).

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  Attendance,
  Credentials,
  CustomClass,
  Marks,
  SectionStatus,
  Snapshot,
  StudentInfo,
  Timetable,
} from "@/types";
import { fetchSnapshot } from "@/lib/api";
import {
  clearCredentials,
  loadCredentials,
  saveCredentials,
} from "@/lib/crypto";
import {
  loadCustomClasses,
  newCustomId,
  saveCustomClasses,
} from "@/lib/customClasses";

type SectionState = SectionStatus | "loading";

type SessionValue = {
  creds: Credentials | null;
  student: StudentInfo | null;
  timetable: Timetable | null;
  attendance: Attendance | null;
  attendanceState: SectionState;
  attendanceMessage: string | null;
  marks: Marks | null;
  marksState: SectionState;
  marksMessage: string | null;
  fetchedAt: string | null;
  isAuthed: boolean;
  restoring: boolean;
  refreshing: boolean;
  customClasses: CustomClass[];
  addCustomClass: (c: Omit<CustomClass, "id">) => void;
  removeCustomClass: (id: string) => void;
  login: (creds: Credentials) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customClasses, setCustomClasses] = useState<CustomClass[]>([]);

  const reg = snapshot?.timetable.student.registrationNumber ?? null;

  // Load this student's custom classes from on-device storage once we know who
  // they are (keyed by registration number).
  useEffect(() => {
    setCustomClasses(reg ? loadCustomClasses(reg) : []);
  }, [reg]);

  // Rehydrate an encrypted session from a prior visit (one login).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadCredentials();
      if (!saved || cancelled) {
        if (!cancelled) setRestoring(false);
        return;
      }
      try {
        const snap = await fetchSnapshot(saved);
        if (!cancelled) {
          setCreds(saved);
          setSnapshot(snap);
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

  const value = useMemo<SessionValue>(() => {
    const sectionState = (s: SectionStatus | undefined): SectionState =>
      creds && !snapshot ? "loading" : (s ?? "loading");
    return {
      creds,
      student: snapshot?.timetable.student ?? null,
      timetable: snapshot?.timetable ?? null,
      attendance: snapshot?.attendance ?? null,
      attendanceState: sectionState(snapshot?.attendanceStatus),
      attendanceMessage: snapshot?.attendanceMessage ?? null,
      marks: snapshot?.marks ?? null,
      marksState: sectionState(snapshot?.marksStatus),
      marksMessage: snapshot?.marksMessage ?? null,
      fetchedAt: snapshot?.fetchedAt ?? null,
      isAuthed: creds !== null,
      restoring,
      refreshing,
      customClasses,
      addCustomClass(c) {
        const next = [...customClasses, { ...c, id: newCustomId() }];
        setCustomClasses(next);
        if (reg) saveCustomClasses(reg, next);
      },
      removeCustomClass(id) {
        const next = customClasses.filter((c) => c.id !== id);
        setCustomClasses(next);
        if (reg) saveCustomClasses(reg, next);
      },
      async login(next) {
        const snap = await fetchSnapshot(next);
        setCreds(next);
        setSnapshot(snap);
        void saveCredentials(next);
      },
      async refresh() {
        if (!creds) return;
        setRefreshing(true);
        try {
          setSnapshot(await fetchSnapshot(creds));
        } finally {
          setRefreshing(false);
        }
      },
      logout() {
        setCreds(null);
        setSnapshot(null);
        clearCredentials();
      },
    };
  }, [creds, snapshot, restoring, refreshing, customClasses, reg]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
