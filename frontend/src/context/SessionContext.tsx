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
import { canImportStudentPortal, importStudentPortal } from "@/lib/studentPortal";
import {
  clearPortalOverride,
  enrichTitles,
  loadPortalOverride,
  savePortalOverride,
  type PortalOverride,
} from "@/lib/portalAttendance";
import {
  attendingOnly,
  optionalKey,
  optionalKeysForCourse,
  optionalKeysForDayOrder,
} from "@/lib/schedule";
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
  /** "academia" when academia published it, "portal" when it came from an
   *  imported student-portal login, null when there is no attendance at all. */
  attendanceSource: "academia" | "portal" | null;
  /** The window an imported portal report covers (it lags a few days). Null
   *  unless the shown attendance is from the portal. */
  reportedPeriod: string | null;
  /** True only in the native shell, where a real portal WebView login works. */
  canImportAttendance: boolean;
  /** Open the portal login and import attendance. Native only. */
  importAttendance: () => Promise<void>;
  /** Discard imported attendance and fall back to academia. */
  clearImportedAttendance: () => void;
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
  /** Optional markings, one per day order and per lab-ness (see optionalKey). */
  optionalCourses: string[];
  /** Marks or unmarks ONE row: this course, on this day order, this side of the
   *  theory/lab split, for exactly the periods the row covers. */
  toggleOptional: (
    dayOrder: number | null,
    code: string,
    isLab: boolean,
    covers: number[],
  ) => void;
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
  const [portalAtt, setPortalAtt] = useState<PortalOverride | null>(null);

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
    setPortalAtt(reg ? loadPortalOverride(reg) : null);
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
    // TEMPORARY dev bypass, remove with lib/__devFixture.ts.
    if (
      process.env.NODE_ENV === "development" &&
      typeof window !== "undefined" &&
      window.location.search.includes("fixture=1")
    ) {
      void import("@/lib/__devFixture").then(({ DEV_SNAPSHOT }) => {
        if (cancelled) return;
        setCreds({ username: "dev", password: "dev" });
        setSnapshot(DEV_SNAPSHOT);
        setRestoring(false);
      });
      return () => {
        cancelled = true;
      };
    }
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

  // Import attendance from the student portal, via a REAL in-app WebView login
  // (native only, see lib/studentPortal.ts). Kept apart from `refresh` on
  // purpose: it opens a login sheet and needs a human, so it can never run on a
  // timer or on foreground the way an academia refresh does.
  const importAttendance = useCallback(async (): Promise<void> => {
    const sp = await importStudentPortal();
    if (sp.attendanceStatus !== "ready" || !sp.attendance) {
      throw new Error(
        sp.attendanceMessage ??
          "The student portal did not return attendance this time.",
      );
    }
    // Titles come from academia's own course list, so the portal's SHOUTY names
    // read the same as everywhere else in the app.
    const titles = new Map(
      (snapshot?.timetable.courses ?? []).map((c) => [
        c.code.toUpperCase(),
        c.title,
      ]),
    );
    const override: PortalOverride = {
      attendance: enrichTitles(sp.attendance, titles),
      marks: sp.marksStatus === "ready" ? sp.marks : null,
      reportedPeriod: sp.reportedPeriod,
      fetchedAt: sp.fetchedAt,
    };
    setPortalAtt(override);
    if (reg) savePortalOverride(reg, override);
  }, [snapshot, reg]);

  // Drop the imported attendance and go back to academia (which may still be
  // gated). The escape hatch for when academia recovers but the app is showing
  // stale portal data, or the student simply wants it gone.
  const clearImportedAttendance = useCallback(() => {
    setPortalAtt(null);
    if (reg) clearPortalOverride(reg);
  }, [reg]);

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

    // Academia is the default and self-heals: the imported portal override is
    // only consulted while academia attendance is NOT ready, so the day
    // academia publishes real attendance again it silently takes back over.
    const academiaReady =
      snapshot?.attendanceStatus === "ready" && !!snapshot.attendance;
    const usePortal = !academiaReady && portalAtt !== null;

    // Marks likewise: prefer academia's, fall back to the portal's only when
    // academia's are not ready and the import carried some.
    const academiaMarksReady =
      snapshot?.marksStatus === "ready" && !!snapshot.marks;
    const usePortalMarks =
      !academiaMarksReady && portalAtt?.marks != null;

    return {
      creds,
      student: snapshot?.timetable.student ?? null,
      timetable: snapshot?.timetable ?? null,
      attendingDayOrders: attendingOnly(
        snapshot?.timetable.dayOrders ?? [],
        optionalCourses,
      ),
      attendance: usePortal
        ? portalAtt.attendance
        : (snapshot?.attendance ?? null),
      attendanceState: usePortal
        ? "ready"
        : sectionState(snapshot?.attendanceStatus),
      attendanceMessage: usePortal ? null : (snapshot?.attendanceMessage ?? null),
      attendanceSource: academiaReady ? "academia" : usePortal ? "portal" : null,
      reportedPeriod: usePortal ? portalAtt.reportedPeriod : null,
      canImportAttendance: canImportStudentPortal(),
      importAttendance,
      clearImportedAttendance,
      marks: usePortalMarks ? portalAtt.marks : (snapshot?.marks ?? null),
      marksState: usePortalMarks ? "ready" : sectionState(snapshot?.marksStatus),
      marksMessage: usePortalMarks ? null : (snapshot?.marksMessage ?? null),
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
      toggleOptional(dayOrder, code, isLab, covers) {
        const grid = snapshot?.timetable.dayOrders ?? [];
        // One key per real period the row stands for. An ordinary row is one
        // period; a merged lab row is its whole run, so a lab stays a single
        // decision while two theory hours are now independent.
        const keys = covers.map((startMin) =>
          optionalKey(dayOrder, code, isLab, startMin),
        );
        const dayKey = `${dayOrder ?? "?"}::${code}::${isLab ? "lab" : "th"}`;
        let next: string[];

        if (keys.every((k) => optionalCourses.includes(k))) {
          next = optionalCourses.filter((c) => !keys.includes(c));
        } else if (optionalCourses.includes(dayKey)) {
          // Written before periods were addressable, and it meant every hour of
          // this course on this day. Spell the rest out before removing one, or
          // the catch-all still in the list would swallow the removal.
          next = [
            ...optionalCourses.filter((c) => c !== dayKey),
            ...optionalKeysForDayOrder(grid, dayOrder, code, isLab).filter(
              (k) => !keys.includes(k),
            ),
          ];
        } else if (optionalCourses.includes(code)) {
          // A legacy bare code meant "this course, everywhere". Unmarking one
          // class of it has to write the rest down explicitly first, or the
          // single removal would be swallowed by the catch-all still sitting
          // in the list.
          next = [
            ...optionalCourses.filter((c) => c !== code),
            ...optionalKeysForCourse(grid, code).filter((k) => !keys.includes(k)),
          ];
        } else {
          next = [...optionalCourses, ...keys.filter((k) => !optionalCourses.includes(k))];
        }

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
    portalAtt,
    importAttendance,
    clearImportedAttendance,
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
