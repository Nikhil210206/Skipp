"use client";

/**
 * The last net: this catches a failure in the root layout itself, which
 * `error.tsx` cannot, because that boundary sits inside the layout it would
 * need to replace.
 *
 * It must bring its own `<html>` and `<body>`, and it cannot rely on the app's
 * fonts or theme tokens loading, since the thing that failed may be exactly
 * what provides them. So the styling here is deliberately hand-written and
 * self-contained rather than composed from `components/ui`. It should never be
 * seen; if it is, it has to work with nothing.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 24px",
          background: "#08080a",
          color: "#f4f4f6",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <title>Skipp could not start</title>
        <p style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b6b75", margin: 0 }}>
          Skipp could not start
        </p>
        <h1 style={{ fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "18px 0 0" }}>
          Something broke early.
        </h1>
        <div style={{ height: 1, background: "#24242b", margin: "24px 0" }} />
        <p style={{ maxWidth: "30ch", lineHeight: 1.6, color: "#9d9da7", margin: 0 }}>
          The app failed before it could draw. Nothing on this device has been
          lost, and your details were never sent anywhere.
        </p>
        {error.digest && (
          <p style={{ marginTop: 20, fontSize: 13, color: "#6b6b75", fontVariantNumeric: "tabular-nums" }}>
            Reference {error.digest}
          </p>
        )}
        <button
          onClick={() => unstable_retry()}
          style={{
            marginTop: 28,
            alignSelf: "flex-start",
            minHeight: 48,
            padding: "0 22px",
            borderRadius: 12,
            border: "1px solid #f2661c",
            background: "transparent",
            color: "#f2661c",
            font: "inherit",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
