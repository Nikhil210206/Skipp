// TEMPORARY, for local verification only. Delete with the `?fixture=1` branch
// in SessionContext once the marks review is done.
import type { CalendarDay, ClassPeriod, Snapshot } from "@/types";

const COURSES = [
  { code: "21CSC302J", title: "Computer Networks", ab: "CN", lab: true },
  { code: "21CSC301T", title: "Formal Language and Automata", ab: "FLA", lab: false },
  { code: "21MAB302T", title: "Discrete Mathematics", ab: "DM", lab: false },
  { code: "21CSE742P", title: "Database Management Systems", ab: "DBMS", lab: true },
  { code: "21CSC303J", title: "Software Engineering", ab: "SE", lab: false },
  { code: "21LEM301T", title: "Critical Thinking", ab: "CT", lab: false },
];

const HOURS = [
  ["08:00", "08:50"], ["08:50", "09:40"], ["09:45", "10:35"], ["10:40", "11:30"],
  ["11:35", "12:25"], ["12:30", "13:20"], ["14:00", "14:50"], ["14:55", "15:45"],
];

const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

function period(hour: number, c: (typeof COURSES)[number]): ClassPeriod {
  const [start, end] = HOURS[hour - 1];
  return {
    hour, start, end, startMin: min(start), endMin: min(end),
    slot: `S${hour}`, code: c.code, title: c.title, abbrev: c.ab,
    faculty: "A Faculty", room: `TP${300 + hour}`, isLab: c.lab,
  };
}

const dayOrders = [1, 2, 3, 4, 5].map((dayOrder) => ({
  dayOrder,
  classes: [1, 2, 3, 4, 6, 7].map((h, i) => period(h, COURSES[(dayOrder + i) % COURSES.length])),
}));

const calendar: CalendarDay[] = (() => {
  const out: CalendarDay[] = [];
  const start = new Date("2026-06-01T00:00:00");
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const holidays: Record<string, string> = {
    "2026-08-15": "Independence Day - Holiday",
    "2026-09-14": "Vinayakar Chathurthi - Holiday",
  };
  let rotate = 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  for (let i = 0; i < 180; i += 1) {
    const d = new Date(start.getTime() + i * 86400000);
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const holiday = holidays[iso];
    const off = d.getDay() === 0 || Boolean(holiday);
    out.push({
      date: iso, weekday: names[d.getDay()], dayOrder: off ? null : rotate,
      event: holiday ?? null, isHoliday: Boolean(holiday),
    });
    if (!off) rotate = (rotate % 5) + 1;
  }
  return out;
})();

const subjects = COURSES.flatMap((c) =>
  (c.lab ? ["Theory", "Practical"] : ["Theory"]).map((category, k) => {
    const conducted = 28 + k * 4;
    const attended = Math.round(conducted * (c.ab === "DM" ? 0.68 : c.ab === "SE" ? 0.76 : 0.91));
    const pct = (attended / conducted) * 100;
    return {
      code: c.code, title: c.title, category, faculty: "A Faculty", slot: "A",
      conducted, attended, percentage: Number(pct.toFixed(2)),
      canSkip: Math.max(0, Math.floor(attended / 0.75 - conducted)),
      mustAttend: pct >= 75 ? 0 : Math.ceil((0.75 * conducted - attended) / 0.25),
      isSafe: pct >= 75,
    };
  }),
);

export const DEV_SNAPSHOT: Snapshot = {
  timetable: {
    student: {
      registrationNumber: "RA2311003010101", name: "DEV STUDENT", program: "B.Tech",
      department: "Engineering(CS)", section: "H1", semester: "5", batch: "2",
      mobile: "9999999999",
    },
    courses: COURSES.map((c) => ({
      code: c.code, title: c.title, credit: c.lab ? 4 : 3, regnType: "Regular",
      category: c.lab ? "Practical" : "Theory", courseType: "Core",
      faculty: "A Faculty", slot: "A", room: "TP301", academicYear: "2026-27",
    })),
    academicYear: "2026-27", dayOrders, calendar,
  },
  attendance: {
    subjects, overallPercentage: 87.4, threshold: 75,
    lastUpdated: new Date().toISOString(),
  },
  attendanceStatus: "ready",
  attendanceMessage: null,
  marks: {
    subjects: COURSES.map((c, i) => ({
      code: c.code, title: c.title,
      components: [
        { name: "CLA-1", scored: 17.5, max: 20 },
        { name: "CLA-2", scored: 14, max: 20 },
      ],
      scoredTotal: 31.5 - i,
      maxTotal: 40,
    })),
    lastUpdated: new Date().toISOString(),
  },
  marksStatus: "ready",
  marksMessage: null,
  fetchedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
};
