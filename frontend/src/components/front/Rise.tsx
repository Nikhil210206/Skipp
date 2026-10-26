import { Fragment } from "react";

/**
 * A headline whose letters rise from under their own line.
 *
 * Each WORD is its own clipping box, so a long line still wraps where a word
 * ends and every letter is clipped by the line it belongs to. The room below
 * the line is padding pulled back out as negative margin, or the clip shaves
 * the tails off g, p and y. The hand needs the same room ABOVE and to the
 * sides: Caveat draws well past its own advance (measured: the "?" reaches
 * 0.18em beyond it and the "f" 0.21em), so 0.1em still cut the "?" in
 * "this?". 0.25em clears every glyph in these headlines.
 *
 * The letters carry `data-char` and are animated by whoever owns the screen.
 * Nothing here hides them: a reveal that never runs leaves the headline
 * readable, which is the standing rule for every entrance in this app.
 *
 * Screen readers get the sentence once, as text, rather than letter by letter.
 */
export default function Rise({
  text,
  className = "",
  style,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const words = text.split(" ");
  return (
    <span className={`block ${className}`} style={style}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((w, i) => (
          <Fragment key={i}>
            <span className="-mx-[0.25em] -my-[0.18em] inline-block overflow-hidden px-[0.25em] py-[0.18em] align-top">
              {[...w].map((ch, j) => (
                <span key={j} data-char className="inline-block">
                  {ch}
                </span>
              ))}
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        ))}
      </span>
    </span>
  );
}
