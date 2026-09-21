"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui";
import { Sheet } from "@/components/ui/Overlay";
import { IconTrash } from "@/components/Icons";
import { useSession } from "@/context/SessionContext";
import {
  savePortalCredentials,
  loadPortalCredentials,
  loadCredentials,
  isRegistrationNumber,
} from "@/lib/crypto";

export function ImportAttendanceAction({ type = "attendance" }: { type?: "attendance" | "marks" }) {
  const { creds: sessionCreds, portalCreds, autoImportAttendance } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleOpen = async () => {
    // Look for credentials that are suitable for portal (i.e. NOT a registration number)
    let creds = portalCreds && !isRegistrationNumber(portalCreds.username) ? portalCreds : null;
    if (!creds) {
      const savedPortal = await loadPortalCredentials();
      if (savedPortal && !isRegistrationNumber(savedPortal.username)) {
        creds = savedPortal;
      }
    }
    if (!creds && sessionCreds && !isRegistrationNumber(sessionCreds.username)) {
      creds = sessionCreds;
    }
    if (!creds) {
      const saved = await loadCredentials();
      if (saved && !isRegistrationNumber(saved.username)) {
        creds = saved;
      }
    }

    if (creds) {
      setBusy(true);
      setError(null);
      try {
        await autoImportAttendance(creds);
        void savePortalCredentials(creds);
        setBusy(false);
        return;
      } catch (err) {
        setBusy(false);
        setOpen(true);
        setError(err instanceof Error ? err.message : "Auto-import failed. Please verify your credentials.");
        setUsername(creds.username);
        setPassword(creds.password);
        return;
      }
    }

    // No credentials saved yet, open modal for Net ID and Password
    setError(null);
    setOpen(true);
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUsername = username.trim();
    const cleanUsername = rawUsername.includes("@")
      ? rawUsername.split("@")[0].trim()
      : rawUsername;

    if (!cleanUsername || !password) return;

    if (isRegistrationNumber(cleanUsername)) {
      setError("Student Portal requires your SRM Net ID (e.g. ab1234), not your registration number.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const creds = { username: cleanUsername, password };
      await autoImportAttendance(creds);
      await savePortalCredentials(creds);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={handleOpen} disabled={busy}>
        {busy ? "Importing…" : "Import from student portal"}
      </Button>

      <Sheet
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={type === "marks" ? "Get your marks" : "Get your attendance"}
      >
        <div className="flex flex-col gap-5 pb-2">
          <p className="text-body text-text-2">
            Academia has not published {type} yet, so Skipp reads {type === "marks" ? "them" : "it"} straight
            from the SRM student portal instead.
          </p>

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

            {error && <p className="text-callout text-risk mt-1">{error}</p>}

            <div className="mt-2">
              <Button type="submit" variant="primary" size="lg" full disabled={busy || !username || !password}>
                {busy ? "Signing in…" : "Import"}
              </Button>
            </div>
          </form>

          <p className="text-callout text-text-3 mt-2">
            Your credentials are encrypted on-device. Verification checks are handled automatically.
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

export function PortalSourceNote({ type = "attendance" }: { type?: "attendance" | "marks" }) {
  const {
    creds: sessionCreds,
    portalCreds,
    reportedPeriod,
    autoImportAttendance,
    clearImportedAttendance,
    isAutoSyncing,
  } = useSession();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "updating" | "updated">("idle");
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updatedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    if (updatedTimer.current) clearTimeout(updatedTimer.current);
  }, []);

  const handleClear = () => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    if (armed) {
      setArmed(false);
      clearImportedAttendance();
      return;
    }
    setArmed(true);
    disarmTimer.current = setTimeout(() => setArmed(false), 3000);
  };

  const handleUpdate = async () => {
    if (busy || isAutoSyncing) return;

    // Look for credentials that are suitable for portal (i.e. NOT a registration number)
    let creds = portalCreds && !isRegistrationNumber(portalCreds.username) ? portalCreds : null;
    if (!creds) {
      const savedPortal = await loadPortalCredentials();
      if (savedPortal && !isRegistrationNumber(savedPortal.username)) {
        creds = savedPortal;
      }
    }
    if (!creds && sessionCreds && !isRegistrationNumber(sessionCreds.username)) {
      creds = sessionCreds;
    }
    if (!creds) {
      const saved = await loadCredentials();
      if (saved && !isRegistrationNumber(saved.username)) {
        creds = saved;
      }
    }

    if (creds) {
      setBusy(true);
      setStatus("updating");
      setError(null);
      try {
        await autoImportAttendance(creds);
        void savePortalCredentials(creds);
        setStatus("updated");
        if (updatedTimer.current) clearTimeout(updatedTimer.current);
        updatedTimer.current = setTimeout(() => setStatus("idle"), 2500);
        return;
      } catch (err) {
        setStatus("idle");
        setOpen(true);
        setError(err instanceof Error ? err.message : "Auto-update failed. Please check your credentials.");
        setUsername(creds.username);
        setPassword(creds.password);
        return;
      } finally {
        setBusy(false);
      }
    }

    // No valid credentials found, open modal
    setOpen(true);
    setError(null);
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUsername = username.trim();
    const cleanUsername = rawUsername.includes("@")
      ? rawUsername.split("@")[0].trim()
      : rawUsername;

    if (!cleanUsername || !password) return;

    if (isRegistrationNumber(cleanUsername)) {
      setError("Student Portal requires your SRM Net ID (e.g. ab1234), not your registration number.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const creds = { username: cleanUsername, password };
      await autoImportAttendance(creds);
      await savePortalCredentials(creds);
      setOpen(false);
      setStatus("updated");
      if (updatedTimer.current) clearTimeout(updatedTimer.current);
      updatedTimer.current = setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed. Please check your credentials.");
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
          <button
            type="button"
            data-btn
            data-update
            onClick={handleUpdate}
            disabled={busy || isAutoSyncing}
            className={`inline-flex min-h-11 select-none items-center justify-center rounded-control px-5 text-body font-semibold tracking-[-0.01em] transition-all duration-150 ease-out disabled:pointer-events-none disabled:opacity-35 ${
              status === "updated"
                ? "bg-safe text-ink-0"
                : "bg-risk text-ink-0 hover:bg-risk/90 active:bg-risk/80"
            }`}
          >
            {status === "updating" || isAutoSyncing
              ? "Updating..."
              : status === "updated"
              ? "Updated!"
              : "Update"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            aria-label={armed ? "Tap again to clear imported attendance" : "Clear imported attendance"}
            className={`group -m-3 inline-flex min-h-11 min-w-11 select-none items-center justify-center gap-1 p-3 text-callout transition-colors duration-150 ease-out ${
              armed ? "text-risk" : "text-text-3 hover:text-text-2"
            }`}
          >
            <IconTrash size={16} open={armed} />
            {armed && <span>Sure?</span>}
          </button>
        </div>
      </div>
      
      <Sheet open={open} onClose={() => { if (!busy) setOpen(false); }} title={`Update ${type}`}>
        <div className="flex flex-col gap-5 pb-2">
          <p className="text-body text-text-2">
            Enter your SRM Net ID and password. Skipp solves verification checks automatically.
          </p>

          <form onSubmit={run} className="flex flex-col gap-3">
            <Field
              id="re-username"
              label="SRM Net ID"
              suffix="@srmist.edu.in"
              value={username}
              onChange={setUsername}
              autoComplete="username"
            />
            <Field
              id="re-password"
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {error && <p className="text-callout text-risk mt-1">{error}</p>}
            <div className="mt-2">
              <Button type="submit" variant="primary" size="lg" full disabled={busy || !username || !password}>
                {busy ? "Signing in…" : "Update"}
              </Button>
            </div>
          </form>

          <p className="text-callout text-text-3 mt-2">
            Your credentials are encrypted on-device.
          </p>
        </div>
      </Sheet>
    </>
  );
}
