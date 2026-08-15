"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * A screen-level control, rendered into the persistent masthead.
 *
 * The shell used to be re-rendered by each page, so a page could simply hand it
 * an `action` prop. Now the shell lives in the route group's layout and mounts
 * once for the whole session (which is the point: it is what stopped every tab
 * change tearing down the chrome and rebuilding it on the frames the transition
 * needed). A layout cannot take props from the page inside it, so the one thing
 * a page still needs to put up there travels by portal instead.
 *
 * The slot is a plain DOM node published by the layout through a module store.
 * `useSyncExternalStore` rather than state set from an effect, matching
 * `useSeenNotice` and `useFeedbackDue`: the React compiler lint rejects
 * setState in an effect, and the server snapshot has no DOM to portal into.
 */

let slot: HTMLElement | null = null;
const subscribers = new Set<() => void>();

/**
 * Ref callback for the masthead's slot element. Called during commit, which is
 * a safe moment to notify subscribers; returning the cleanup clears the node
 * again if the shell is ever unmounted (signing out).
 */
export function actionSlotRef(el: HTMLElement | null): void {
  slot = el;
  subscribers.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

export default function ShellAction({ children }: { children: React.ReactNode }) {
  const target = useSyncExternalStore(
    subscribe,
    () => slot,
    () => null,
  );
  // Refs attach bottom up, so on the very first mount the page commits before
  // the layout and there is nothing to portal into yet. The store notifies a
  // frame later and this renders properly. Only ever on the first mount: the
  // layout persists from then on, and so does the node.
  if (!target) return null;
  return createPortal(children, target);
}
