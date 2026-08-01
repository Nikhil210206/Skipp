import Link from "next/link";

/**
 * A mistyped or stale URL. Rare in a five tab app, but a PWA keeps old links
 * alive on the home screen, so it is reachable and should not be Next's default
 * black-on-white page in the middle of a black app.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-[var(--gutter)] pb-[max(28px,env(safe-area-inset-bottom))]">
      <p className="text-label uppercase text-text-3">No such page</p>
      <p className="tnum optical mt-5 text-poster">404</p>
      <div className="bleed mt-7 h-px bg-line" />
      <p className="mt-5 max-w-[28ch] text-body text-text-2">
        That link does not go anywhere in Skipp.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex min-h-11 items-center self-start rounded-control border border-accent px-5 text-body font-semibold text-accent"
      >
        Go home
      </Link>
    </main>
  );
}
