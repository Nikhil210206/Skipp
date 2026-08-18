// Shared types that mirror the FastAPI backend JSON shapes (camelCase).
// Keep in sync with backend/models/*.py.

export type Credentials = { username: string; password: string };

// ---- Timetable / courses (backend/models/timetable.py) ----
export type StudentInfo = {
  registrationNumber: string | null;
  name: string | null;
  program: string | null;
  department: string | null;
  section: string | null;
  semester: string | null;
  batch: string | null;
  mobile: string | null;
};

export type Course = {
  code: string;
  title: string;
  credit: number | null;
  regnType: string | null;
  category: string | null;
  courseType: string | null;
  faculty: string | null;
  slot: string | null;
  room: string | null;
  academicYear: string | null;
};

export type ClassPeriod = {
  hour: number;
  start: string; // "08:00"
  end: string;
  startMin: number; // minutes since midnight (24h)
  endMin: number;
  slot: string;
  code: string;
  title: string;
  abbrev: string;
  faculty: string | null;
  room: string | null;
  isLab: boolean;
};

export type DayOrderSchedule = {
  dayOrder: number;
  classes: ClassPeriod[];
};

export type CalendarDay = {
  date: string; // ISO YYYY-MM-DD
  weekday: string;
  dayOrder: number | null;
  event: string | null;
  isHoliday: boolean;
};

export type Timetable = {
  student: StudentInfo;
  courses: Course[];
  academicYear: string | null;
  dayOrders: DayOrderSchedule[];
  calendar: CalendarDay[];
};

// ---- Attendance (backend/models/attendance.py) ----
export type Subject = {
  code: string;
  title: string;
  category: string;
  faculty: string | null;
  slot: string | null;
  conducted: number;
  attended: number;
  percentage: number;
  canSkip: number;
  mustAttend: number;
  isSafe: boolean;
};

export type Attendance = {
  subjects: Subject[];
  overallPercentage: number;
  threshold: number;
  lastUpdated: string;
};

// ---- Marks (backend/models/marks.py) ----
export type MarkComponent = { name: string; scored: number; max: number };

export type SubjectMarks = {
  code: string;
  title: string;
  components: MarkComponent[];
  scoredTotal: number;
  maxTotal: number;
};

export type Marks = {
  subjects: SubjectMarks[];
  lastUpdated: string;
};

// ---- User-added custom classes (on-device only) ----
export type CustomClass = {
  id: string;
  dayOrder: number;
  startMin: number; // minutes since midnight (24h)
  endMin: number;
  title: string;
  abbrev: string;
  room: string | null;
  faculty: string | null;
};

// Combined snapshot (backend/models/snapshot.py), fetched in one login.
export type SectionStatus = "ready" | "gated" | "error";

// ---- Student portal fallback (backend/models/student_portal.py) ----
// Parsed from report HTML a real in-app WebView login captured, when academia
// has stopped publishing attendance but the student portal has not. Carries no
// timetable/calendar: this source has none, and the app merges it into what
// academia already gave.
export type StudentPortalSnapshot = {
  attendance: Attendance | null;
  attendanceStatus: SectionStatus;
  attendanceMessage: string | null;
  marks: Marks | null;
  marksStatus: SectionStatus;
  marksMessage: string | null;
  // The window the portal's own report covers, e.g. "21/Jul/2026 To
  // 14/Aug/2026". The portal lags a few days, so a class you just sat may not
  // be in it yet. Surface it so that reads as "not yet" rather than "wrong".
  reportedPeriod: string | null;
  fetchedAt: string;
};

export type Snapshot = {
  timetable: Timetable;
  attendance: Attendance | null;
  attendanceStatus: SectionStatus;
  attendanceMessage: string | null;
  marks: Marks | null;
  marksStatus: SectionStatus;
  marksMessage: string | null;
  fetchedAt: string;
};
