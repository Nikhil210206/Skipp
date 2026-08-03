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
  DayOrderSchedule,
  Marks,
  SectionStatus,
  Snapshot,
  StudentInfo,
  Timetable,
} from "@/types";
import { AuthError, fetchSnapshot } from "@/lib/api";
import { attendingOnly } from "@/lib/schedule";
import { notifyAttendanceChanges } from "@/lib/notify";
import {
  clearCredentials,
  clearSnapshot,
  loadCredentials,
  loadSnapshot,
  saveCredentials,
  saveSnapshot,
} from "@/lib/crypto";

// How old cached data may get before the app quietly goes and looks again.
// Faculty mark attendance a handful of times a day, so a tighter window spends
// sign-ins on fetching data that has not changed. Every sign-in counts against
// the portal's own limits (CAPTCHA at IN108, a hard daily cap at SI503).
const STALE_MS = 60 * 60 * 1000; // 1 hour

/**
 * The floor under a deliberate pull to refresh. Without one, pulling is free to
 * the finger and expensive to the account: ten pulls is ten real portal
 * sign-ins, which is roughly what it takes to earn a CAPTCHA.
 */
const MANUAL_MIN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * How long to leave the portal alone once it has said no.
 *
 * The rate limits clear on their own, but only if we stop knocking. Retrying on
 * every launch and every foreground is what turns a short cooldown into a lost
 * day.
 */
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

/** What a refresh actually did, so the UI can say so honestly. */
export type RefreshOutcome = "updated" | "fresh" | "cooldown" | "failed";

/** Wrong Net ID or wrong password, as opposed to the portal simply saying no. */
function isBadCredentials(e: AuthError): boolean {
  return e.code === "user_not_found" || e.code === "wrong_password";
}

/**
 * When the portal last rate limited us. Module scope rather than state, so it
 * survives the remount every navigation causes and a new screen cannot forget
 * that we are meant to be standing down.
 */
let cooldownUntil = 0;

/** Records a refusal so nothing else tries until the cooldown is up. */
function noteFailure(e: unknown): void {
  if (e instanceof AuthError && (e.code === "captcha" || e.code === "signin_limit")) {
    cooldownUntil = Date.now() + COOLDOWN_MS;
  }
}

const inCooldown = () => Date.now() < cooldownUntil;

function isStale(fetchedAt: string): boolean {
  const t = Date.parse(fetchedAt);
  return Number.isNaN(t) || Date.now() - t > STALE_MS;
}
import {
  diffAttendance,
  loadSeenAttendance,
  saveSeenAttendance,
  type AttendanceChange,
} from "@/lib/reminders";
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
  /**
   * The day-order grid with optional courses removed. Use this for anything
   * that computes attendance; `timetable.dayOrders` is the raw grid and exists
   * for the schedule screen, which must still show optional classes.
   */
  attendingDayOrders: DayOrderSchedule[];
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
  /** Classes the portal recorded since the previous snapshot. */
  attendanceChanges: AttendanceChange[];
  displayName: string; // custom name if set, else official first name
  setDisplayName: (name: string) => void;
  login: (creds: Credentials) => Promise<void>;
  /** Resolves with what actually happened, so the caller can say so. */
  refresh: () => Promise<RefreshOutcome>;
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
  const [attendanceChanges, setChanges] = useState<AttendanceChange[]>([]);
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

  /**
   * The one way fresh data enters the app. Before installing a snapshot it is
   * compared against the last one seen, so "what the portal marked since you
   * last looked" is computed exactly once, at the moment it becomes true.
   */
  const installSnapshot = useCallback((snap: Snapshot) => {
    const id = snap.timetable.student.registrationNumber;
    if (id) {
      const diffed = diffAttendance(snap.attendance, loadSeenAttendance(id));
      setChanges(diffed);
      // The same diff, raised as a real notification rather than only as a line
      // in the Reminders feed. Local, and raised here because this is the single
      // door fresh data enters by, so it fires once per genuine change rather
      // than once per glance at the app.
      void notifyAttendanceChanges(diffed);
      saveSeenAttendance(id, snap.attendance);
    }
    setSnapshot(snap);
  }, []);

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
        // Seed the baseline from what is on screen. Without this the first
        // refresh of a session has nothing to compare against and silently
        // reports no change, however much the portal marked in between.
        saveSeenAttendance(
          cached.timetable.student.registrationNumber,
          cached.attendance,
        );
        setRestoring(false);
        if (isStale(cached.fetchedAt) && !inCooldown()) void backgroundRefresh(saved);
        return;
      }

      // No cache, so we must fetch (this shows the restoring spinner).
      try {
        const snap = await fetchSnapshot(saved);
        if (!cancelled) {
          setCreds(saved);
          installSnapshot(snap);
          void saveSnapshot(snap);
        }
      } catch (e) {
        // Only forget the saved session when the credentials are genuinely
        // wrong. A rate limit also arrives as an AuthError (HTTP 429), and
        // signing the student out over one meant they retyped their password,
        // which spent another sign-in against the very limit they had just hit.
        if (e instanceof AuthError && isBadCredentials(e)) clearCredentials();
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    async function backgroundRefresh(withCreds: Credentials) {
      try {
        const fresh = await fetchSnapshot(withCreds);
        if (!cancelled) {
          installSnapshot(fresh);
          void saveSnapshot(fresh);
        }
      } catch (e) {
        // Keep showing the cached snapshot; a rate-limit or blip is non-fatal.
        // Recording it is what stops the next launch knocking again.
        noteFailure(e);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [installSnapshot]);

  // Silent background refresh (used by focus + pull-to-refresh's stale checks).
  const bgRefreshing = useRef(false);
  const refreshIfStale = useCallback(async () => {
    if (!creds || !snapshot || bgRefreshing.current) return;
    if (!isStale(snapshot.fetchedAt) || inCooldown()) return;
    bgRefreshing.current = true;
    try {
      const fresh = await fetchSnapshot(creds);
      installSnapshot(fresh);
      void saveSnapshot(fresh);
    } catch (e) {
      noteFailure(e); // keep cache, and stop knocking
    } finally {
      bgRefreshing.current = false;
    }
  }, [creds, snapshot, installSnapshot]);

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

  // Stable across renders. It used to be rebuilt inside the value memo, so its
  // identity changed whenever anything in the session did, including the
  // `refreshing` flag it sets itself. PullToRefresh depends on it, so the pull
  // handler was being unregistered and re-registered during its own refresh.
  const refresh = useCallback(async (): Promise<RefreshOutcome> => {
    if (!creds) return "failed";
    // A pull is deliberate, so it is honoured ahead of the hourly window, but
    // it still cannot reach the portal more than once every few minutes. The
    // caller is told which happened so it can say "up to date" rather than
    // pretending to have fetched.
    if (snapshot && Date.now() - Date.parse(snapshot.fetchedAt) < MANUAL_MIN_MS) {
      return "fresh";
    }
    if (inCooldown()) return "cooldown";
    setRefreshing(true);
    try {
      const fresh = await fetchSnapshot(creds);
      installSnapshot(fresh);
      void saveSnapshot(fresh);
      return "updated";
    } catch (e) {
      // Rate-limited or offline: keep showing the cached snapshot rather than
      // erroring. (A daily-cap hit just means "no update right now".)
      noteFailure(e);
      return e instanceof AuthError ? "cooldown" : "failed";
    } finally {
      setRefreshing(false);
    }
  }, [creds, snapshot, installSnapshot]);

  const value = useMemo<SessionValue>(() => {
    const sectionState = (s: SectionStatus | undefined): SectionState =>
      creds && !snapshot ? "loading" : (s ?? "loading");
    return {
      creds,
      student: snapshot?.timetable.student ?? null,
      timetable: snapshot?.timetable ?? null,
      attendingDayOrders: attendingOnly(
        snapshot?.timetable.dayOrders ?? [],
        optionalCourses,
      ),
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
      attendanceChanges,
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
        // Saving a name identical to the portal's creates an override that
        // does nothing except outlive the account it was typed on, which is
        // how one student ended up greeted by another student's name.
        const custom = trimmed && trimmed !== officialFirst ? trimmed : "";
        setCustomName(custom || null);
        if (reg) saveDisplayName(reg, custom);
      },
      async login(next) {
        const snap = await fetchSnapshot(next);
        setCreds(next);
        installSnapshot(snap);
        void saveCredentials(next);
        void saveSnapshot(snap);
      },
      refresh,
      logout() {
        setCreds(null);
        setSnapshot(null);
        clearCredentials();
        clearSnapshot();
      },
    };
  }, [
    installSnapshot,
    creds,
    snapshot,
    restoring,
    refreshing,
    customClasses,
    optionalCourses,
    attendanceChanges,
    customName,
    officialFirst,
    reg,
    refresh,
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
