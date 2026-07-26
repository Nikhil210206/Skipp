"use client";

// Client-side session. ONE portal login per session: on login (and on reload-
// rehydrate) we fetch the combined snapshot (timetable + attendance + marks) and
// cache it, so switching tabs never triggers another Zoho sign-in (which is
// daily-capped). Credentials are persisted encrypted on-device (lib/crypto).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { AuthError, fetchSnapshot } from "@/lib/api";
import {
  clearCredentials,
  clearSnapshot,
  loadCredentials,
  loadSnapshot,
  saveCredentials,
  saveSnapshot,
} from "@/lib/crypto";

// Background-refresh the cached snapshot only when it's older than this. Fresh
// enough that a class update shows soon after you open the app, but capped so
// rapid reloads/focus events don't burn Zoho sign-ins (which are daily-limited).
const STALE_MS = 15 * 60 * 1000; // 15 minutes

function isStale(fetchedAt: string): boolean {
  const t = Date.parse(fetchedAt);
  return Number.isNaN(t) || Date.now() - t > STALE_MS;
}
import {
  loadCustomClasses,
  loadDisplayName,
  loadOptionalCourses,
  newCustomId,
  saveCustomClasses,
  saveDisplayName,
  saveOptionalCourses,
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
  optionalCourses: string[];
  toggleOptional: (code: string) => void;
  displayName: string; // custom name if set, else official first name
  setDisplayName: (name: string) => void;
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
  const [optionalCourses, setOptionalCourses] = useState<string[]>([]);
  const [customName, setCustomName] = useState<string | null>(null);
  const [loadedReg, setLoadedReg] = useState<string | null>(null);

  const reg = snapshot?.timetable.student.registrationNumber ?? null;
  // The portal shouts names in caps. Present it the way a person writes it.
  const officialFirst = titleCase(
    snapshot?.timetable.student.name?.split(" ")[0] ?? "",
  );

  // Load this student's on-device prefs when the logged-in student changes.
  // Done during render (React's recommended reset-on-change pattern) rather than
  // in an effect, so the loaded prefs are available on the first paint.
  if (reg !== loadedReg) {
    setLoadedReg(reg);
    setCustomClasses(reg ? loadCustomClasses(reg) : []);
    setOptionalCourses(reg ? loadOptionalCourses(reg) : []);
    setCustomName(reg ? loadDisplayName(reg) : null);
  }

  // Rehydrate from a prior visit. If we have an encrypted cached snapshot, show
  // it INSTANTLY (no login, no spinner) and only re-fetch in the background when
  // it's stale, so reloads within a session cost zero Zoho sign-ins.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadCredentials();
      if (!saved) {
        if (!cancelled) setRestoring(false);
        return;
      }
      const cached = await loadSnapshot();
      if (cancelled) return;

      if (cached) {
        // Instant: show cached data, then quietly refresh if it's gone stale.
        setCreds(saved);
        setSnapshot(cached);
        setRestoring(false);
        if (isStale(cached.fetchedAt)) void backgroundRefresh(saved);
        return;
      }

      // No cache, so we must fetch (this shows the restoring spinner).
      try {
        const snap = await fetchSnapshot(saved);
        if (!cancelled) {
          setCreds(saved);
          setSnapshot(snap);
          void saveSnapshot(snap);
        }
      } catch (e) {
        // Only forget the saved session on a real auth failure. A transient
        // error (backend down, network blip, rate limit) keeps the creds so a
        // reload retries without the user re-typing their password.
        if (e instanceof AuthError) clearCredentials();
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    async function backgroundRefresh(withCreds: Credentials) {
      try {
        const fresh = await fetchSnapshot(withCreds);
        if (!cancelled) {
          setSnapshot(fresh);
          void saveSnapshot(fresh);
        }
      } catch {
        // Keep showing the cached snapshot; a rate-limit/blip is non-fatal.
      }
    }

    return () => {
      cancelled = true;
    };
  }, []);

  // Silent background refresh (used by focus + pull-to-refresh's stale checks).
  const bgRefreshing = useRef(false);
  const refreshIfStale = useCallback(async () => {
    if (!creds || !snapshot || bgRefreshing.current) return;
    if (!isStale(snapshot.fetchedAt)) return;
    bgRefreshing.current = true;
    try {
      const fresh = await fetchSnapshot(creds);
      setSnapshot(fresh);
      void saveSnapshot(fresh);
    } catch {
      // keep cache
    } finally {
      bgRefreshing.current = false;
    }
  }, [creds, snapshot]);

  // Refresh when the app is reopened / brought back to the foreground, if the
  // cached data has gone stale, so a class update shows up without any manual
  // action, while the 15-min guard keeps sign-ins rare.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") void refreshIfStale();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshIfStale]);

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
      optionalCourses,
      toggleOptional(code) {
        const next = optionalCourses.includes(code)
          ? optionalCourses.filter((c) => c !== code)
          : [...optionalCourses, code];
        setOptionalCourses(next);
        if (reg) saveOptionalCourses(reg, next);
      },
      displayName: customName || officialFirst || "there",
      setDisplayName(name) {
        const trimmed = name.trim();
        setCustomName(trimmed || null);
        if (reg) saveDisplayName(reg, trimmed);
      },
      async login(next) {
        const snap = await fetchSnapshot(next);
        setCreds(next);
        setSnapshot(snap);
        void saveCredentials(next);
        void saveSnapshot(snap);
      },
      async refresh() {
        if (!creds) return;
        setRefreshing(true);
        try {
          const fresh = await fetchSnapshot(creds);
          setSnapshot(fresh);
          void saveSnapshot(fresh);
        } catch {
          // Rate-limited or offline: keep showing the cached snapshot rather
          // than erroring. (A daily-cap hit just means "no update right now".)
        } finally {
          setRefreshing(false);
        }
      },
      logout() {
        setCreds(null);
        setSnapshot(null);
        clearCredentials();
        clearSnapshot();
      },
    };
  }, [
    creds,
    snapshot,
    restoring,
    refreshing,
    customClasses,
    optionalCourses,
    customName,
    officialFirst,
    reg,
  ]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}

/** "NIKHIL" becomes "Nikhil"; anything already mixed-case is left alone. */
function titleCase(name: string): string {
  if (!name || name !== name.toUpperCase()) return name;
  return name[0] + name.slice(1).toLowerCase();
}
