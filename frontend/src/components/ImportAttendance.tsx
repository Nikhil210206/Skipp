"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui";
import { Sheet } from "@/components/ui/Overlay";
import { useSession } from "@/context/SessionContext";
import { initStudentPortalLogin } from "@/lib/api";
import type { StudentPortalCaptchaResponse } from "@/types";

export function ImportAttendanceAction() {
  const { importAttendance } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [sessionData, setSessionData] = useState<StudentPortalCaptchaResponse | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");

  const loadCaptcha = async () => {
    setBusy(true);
    setError(null);
    setSessionData(null);
    setCaptcha("");
    try {
      const data = await initStudentPortalLogin();
      setSessionData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load captcha.");
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!sessionData) {
      loadCaptcha();
    }
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionData || !username || !password || !captcha) return;
    
    setBusy(true);
    setError(null);
    try {
      await importAttendance({
        username: username.trim(),
        password,
        captcha,
        ...sessionData
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed. Try again.");
      // Refresh captcha on failure
      loadCaptcha();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={handleOpen}>
        Import from student portal
      </Button>

      <Sheet
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Get your attendance"
      >
        <div className="flex flex-col gap-5 pb-2">
          <p className="text-body text-text-2">
            Academia has not published attendance yet, so Skipp reads it straight
            from the SRM student portal instead.
          </p>

          {!sessionData && busy ? (
            <div className="flex items-center justify-center p-6">
              <span className="text-callout text-text-3">Loading portal...</span>
            </div>
          ) : sessionData ? (
            <form onSubmit={run} className="flex flex-col gap-3">
              <Field
                id="username"
                label="SRM Net ID"
                suffix="@srmist.edu.in"
                value={username}
                onChange={setUsername}
                autoComplete="username"
              />
              <Field
                id="password"
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              
              <div className="flex flex-col gap-2 rounded-control border border-line bg-ink-1 p-3">
                <span className="text-label uppercase text-text-3">Captcha</span>
                <img 
                  src={sessionData.captchaBase64} 
                  alt="Captcha" 
                  className="h-auto w-full max-w-[220px] rounded-md bg-white object-contain" 
                />
                <input
                  type="text"
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value)}
                  placeholder="Type characters above"
                  className="mt-1 w-full appearance-none bg-transparent text-headline text-text-1 outline-none placeholder:text-text-3"
                  required
                />
              </div>

              {error && <p className="text-callout text-risk mt-1">{error}</p>}
              
              <div className="mt-2">
                <Button type="submit" variant="primary" size="lg" full disabled={busy || !username || !password || !captcha}>
                  {busy ? "Signing in…" : "Import"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-3 p-4">
              {error && <p className="text-callout text-risk">{error}</p>}
              <Button onClick={loadCaptcha} variant="secondary">Try Again</Button>
            </div>
          )}

          <p className="text-callout text-text-3 mt-2">
            Your portal password is only used for this login and is never saved by Skipp.
          </p>
        </div>
      </Sheet>
    </>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  suffix,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  suffix?: string;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <label
      htmlFor={id}
      className="block cursor-text rounded-control border border-line bg-ink-1 px-4 py-3 transition-colors focus-within:border-accent"
    >
      <span className="block text-label uppercase text-text-3">{label}</span>
      {suffix ? (
        <div className="mt-1.5 flex items-baseline gap-1">
          <input
            ref={input}
            id={id}
            type={type}
            value={value}
            autoComplete={autoComplete}
            onChange={(e) => onChange(e.target.value)}
            className="min-w-0 flex-1 appearance-none bg-transparent text-headline text-text-1 outline-none placeholder:text-text-3"
          />
          <span className="shrink-0 text-headline text-text-3">{suffix}</span>
        </div>
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1.5 w-full appearance-none bg-transparent text-headline text-text-1 outline-none placeholder:text-text-3"
        />
      )}
    </label>
  );
}

export function PortalSourceNote() {
  const { reportedPeriod, importAttendance, clearImportedAttendance } = useSession();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [sessionData, setSessionData] = useState<StudentPortalCaptchaResponse | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadCaptcha = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await initStudentPortalLogin();
      setSessionData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load captcha.");
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setCaptcha("");
    loadCaptcha();
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionData || !username || !password || !captcha) return;
    
    setBusy(true);
    setError(null);
    try {
      await importAttendance({
        username: username.trim(),
        password,
        captcha,
        ...sessionData
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed. Try again.");
      loadCaptcha();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line-soft pt-3">
        <p className="min-w-0 flex-1 text-callout text-text-3">
          From the student portal
          {reportedPeriod ? ` · ${reportedPeriod}` : ""}
        </p>
        <div className="flex shrink-0 items-center gap-4">
          {/* Update has a SHAPE now, and it is filled rather than tinted.
              Two earlier versions were read straight past: a `text-text-2`
              underline, then the same underline at the top text level in the
              emphasis weight. Both were still just a word in a row of words,
              and a word is what the eye skips. A filled block is an object, and
              an object in a page of type is the one thing that cannot be
              skimmed over.

              Red on request. Worth knowing what it costs: this app reserves
              `risk` for a subject below the line (section 7.5, colour marks
              trouble), so a red control here is the loudest thing on a screen
              whose whole point is that a healthy student sees no colour at all.
              It is the one exception, and it is deliberate.

              `text-ink-0` rather than a fixed white: ink-0 is the page colour,
              so it flips with the theme and stays legible on both the light
              red the dark themes use and the dark red the light ones do.

              `data-btn`, so the material themes treat it as a button (Brutal's
              hard offset, Clay's soft shadow, Stone's lit edge) instead of it
              being the one control in the app they cannot see. */}
          <button
            type="button"
            data-btn
            data-update
            onClick={handleOpen}
            disabled={busy}
            className="inline-flex min-h-11 select-none items-center justify-center rounded-control bg-risk px-5 text-body font-semibold tracking-[-0.01em] text-ink-0 transition-colors duration-150 ease-out hover:bg-risk/90 active:bg-risk/80 disabled:pointer-events-none disabled:opacity-35"
          >
            Update
          </button>
          {/* Stays a quiet word. Clear throws the imported attendance away and
              is wanted about once ever, so it must not compete. */}
          <button
            type="button"
            onClick={clearImportedAttendance}
            className="-my-3 inline-flex min-h-11 items-center py-3 text-callout text-text-3 underline underline-offset-4"
          >
            Clear
          </button>
        </div>
      </div>
      
      <Sheet open={open} onClose={() => { if (!busy) setOpen(false); }} title="Update attendance">
        <div className="flex flex-col gap-5 pb-2">
          {!sessionData && busy ? (
            <div className="flex items-center justify-center p-6">
              <span className="text-callout text-text-3">Loading portal...</span>
            </div>
          ) : sessionData ? (
            <form onSubmit={run} className="flex flex-col gap-3">
              <Field
                id="re-username"
                label="SRM Net ID"
                suffix="@srmist.edu.in"
                value={username}
                onChange={setUsername}
              />
              <Field
                id="re-password"
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
              />
              <div className="flex flex-col gap-2 rounded-control border border-line bg-ink-1 p-3">
                <span className="text-label uppercase text-text-3">Captcha</span>
                <img 
                  src={sessionData.captchaBase64} 
                  alt="Captcha" 
                  className="h-auto w-full max-w-[220px] rounded-md bg-white object-contain" 
                />
                <input
                  type="text"
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value)}
                  placeholder="Type characters above"
                  className="mt-1 w-full appearance-none bg-transparent text-headline text-text-1 outline-none placeholder:text-text-3"
                  required
                />
              </div>
              {error && <p className="text-callout text-risk mt-1">{error}</p>}
              <div className="mt-2">
                <Button type="submit" variant="primary" size="lg" full disabled={busy || !username || !password || !captcha}>
                  {busy ? "Signing in…" : "Update"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-3 p-4">
              {error && <p className="text-callout text-risk">{error}</p>}
              <Button onClick={loadCaptcha} variant="secondary">Try Again</Button>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
