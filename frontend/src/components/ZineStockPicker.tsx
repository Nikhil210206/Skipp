"use client";

import { useState } from "react";
import {
  setZineStock,
  useZineStock,
  ZINE_STOCKS,
  type ZineStock,
} from "@/lib/theme";
import { Printed } from "@/components/looks/ZineParts";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui";

/**
 * ZINE'S STOCK, asked the moment Zine is tapped on Profile.
 *
 * A pop-up rather than a section under the looks: the first build unfolded the
 * choice below the tiles, and it was reported, rightly, as something nobody
 * would notice down there. So tapping Zine applies it and then asks, day or
 * night, and tapping the tile again asks again.
 *
 * Two proofs pulled off the press, each a thumbnail of the Home cover printed
 * on its own stock: the countdown, the keys hanging from the rule, and a "must
 * go" stamp in the second drum, so the two are compared ink for ink as well as
 * paper for paper. Tapping one switches the whole app to it at once, so it
 * repaints behind the pop-up, and thumps an "on press" stamp across that proof.
 *
 * The proofs are painted in fixed colours, like every swatch on Profile,
 * because the tokens are the thing the choice changes. The thumbnail scales in
 * `cqw` with its card, so it stays a true miniature from 320 wide up. Nothing
 * here mounts until the pop-up opens, so only someone choosing Zine fetches the
 * keys drawing.
 */
export default function ZineStockPicker({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const stock = useZineStock();
  // Only the proof just tapped thumps. Cleared on close, or reopening would
  // thump the stamp that was already there.
  const [pressed, setPressed] = useState<ZineStock | null>(null);
  const close = () => {
    setPressed(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      label="Zine stock"
      maxWidth="max-w-sm"
      footer={
        <Button full onClick={close}>
          Print it
        </Button>
      }
    >
      <h2 className="zine-print text-[2rem] uppercase leading-none">
        Day or night?
      </h2>
      <p className="mt-2 text-callout text-text-2">
        Same two inks, two stocks. Tap a proof to see it on the whole app. Tap
        Zine again any time to swap.
      </p>
      {/* Padded inside the scroller, so neither the tilt nor the selection
          ring is shaved off at its edges. */}
      <div
        role="radiogroup"
        aria-label="Zine stock"
        className="grid grid-cols-2 gap-3 px-1.5 pb-2 pt-5"
      >
        {ZINE_STOCKS.map((p, i) => {
          const on = p.id === stock;
          return (
            <button
              key={p.id}
              role="radio"
              aria-checked={on}
              data-proof
              onClick={() => {
                setZineStock(p.id);
                setPressed(p.id);
              }}
              className="@container relative flex flex-col p-2.5 text-left"
              style={{
                background: p.paper,
                color: p.ink,
                borderRadius: 10,
                rotate: i === 0 ? "-1.5deg" : "1.5deg",
                // On press: a ring in the app's own ink, held off the
                // card by a gap of page. Off: a hairline, since a proof
                // in the stock already on screen would otherwise sit on
                // its own colour with no edge.
                boxShadow: on
                  ? "0 0 0 3px var(--color-ink-0), 0 0 0 5.5px var(--color-text-1)"
                  : "0 0 0 1px var(--color-line)",
              }}
            >
              <span
                aria-hidden
                className="zine-typed flex items-center justify-between uppercase leading-none"
                style={{ fontSize: 9, letterSpacing: "0.1em" }}
              >
                <span>Proof 0{i + 1}</span>
                <RegMark />
              </span>

              {/* The cover, in miniature. */}
              <span
                aria-hidden
                className="@container relative mt-1.5 block w-full border-t-[1.5px] border-current"
                style={{ aspectRatio: "16 / 10" }}
              >
                <Printed
                  name="keys"
                  className="absolute"
                  style={{
                    right: "-4%",
                    top: "-3%",
                    width: "54%",
                    aspectRatio: "300 / 350",
                  }}
                />
                <span className="absolute bottom-0 left-0 flex flex-col items-start">
                  <span
                    className="zine-print zine-grain block"
                    style={{ fontSize: "34cqw", lineHeight: 0.75 }}
                  >
                    3h
                  </span>
                  <span
                    className="zine-print zine-grain mt-[4cqw] block uppercase leading-none"
                    style={{
                      background: p.trouble,
                      color: p.paper,
                      fontSize: "7cqw",
                      letterSpacing: "0.04em",
                      padding: "1.6cqw 2.4cqw 1.2cqw",
                      rotate: "-3deg",
                    }}
                  >
                    Must go
                  </span>
                </span>
              </span>

              <span
                className="zine-print mt-2.5 block uppercase leading-none"
                style={{ fontSize: 17 }}
              >
                {p.name}
              </span>
              <span
                className="zine-typed mt-1 block uppercase leading-none"
                style={{ fontSize: 10, letterSpacing: "0.06em" }}
              >
                {p.note}
              </span>

              {on && (
                <span
                  aria-hidden
                  // Across the keys' blades, clear of the countdown and
                  // the name: a stamp over the figure hid the very thing
                  // the two proofs are there to compare.
                  className={`zine-print zine-grain absolute block whitespace-nowrap uppercase leading-none ${
                    pressed === p.id ? "zine-thump" : ""
                  }`}
                  style={{
                    right: 2,
                    top: "46%",
                    background: p.paper,
                    color: p.ink,
                    border: `2.5px solid ${p.ink}`,
                    // Sized with the proof, or on a narrow phone the
                    // stamp outgrows the art and lands on the name.
                    fontSize: "min(15px, 11cqw)",
                    letterSpacing: "0.05em",
                    padding: "5px 8px 4px",
                    rotate: "-9deg",
                  }}
                >
                  On press
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/** A printer's registration mark: the target a proof is lined up by. */
function RegMark() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="size-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <circle cx="6" cy="6" r="3.2" />
      <path d="M6 0v12M0 6h12" />
    </svg>
  );
}
