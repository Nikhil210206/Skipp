// Shared types — mirror the FastAPI backend JSON shapes (camelCase).
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

// ---- Combined snapshot (backend/models/snapshot.py) — one login ----
export type SectionStatus = "ready" | "gated" | "error";

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
