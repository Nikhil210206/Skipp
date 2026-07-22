"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/context/SessionContext";
import { NotAvailableError } from "@/lib/api";
import type { Credentials } from "@/types";

type State<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "gated"; message: string } // portal hasn't enabled this section
  | { status: "error"; message: string };

/** Fetch a per-request resource (attendance/marks) using the session creds. */
export function useResource<T>(
  fetcher: (creds: Credentials) => Promise<T>,
): State<T> {
  const { creds } = useSession();
  const [state, setState] = useState<State<T>>({ status: "loading" });

  useEffect(() => {
    if (!creds) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetcher(creds)
      .then((data) => !cancelled && setState({ status: "ready", data }))
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof NotAvailableError) {
          setState({ status: "gated", message: e.message });
        } else {
          const message =
            e instanceof Error ? e.message : "Something went wrong.";
          setState({ status: "error", message });
        }
      });
    return () => {
      cancelled = true;
    };
    // fetcher is a stable module-level import; creds identity drives refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creds]);

  return state;
}
