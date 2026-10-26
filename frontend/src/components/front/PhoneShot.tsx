import Image, { type StaticImageData } from "next/image";

/**
 * A phone holding a real screen from the app.
 *
 * Every measurement is in `cqw` of the phone itself, so one drawing scales from
 * a 140px thumbnail to a 300px hero with the bezel, the corner radii and the
 * island all keeping their proportion. The numbers are a 390 by 844 screen in
 * a 408 by 906 body: a 9px bezel, the status bar band the screenshot does not
 * carry (44px, painted in the screen's own colour), then the screenshot.
 *
 * No fake status bar. The band is left empty in the screen's colour, which is
 * what a phone shows behind the island anyway.
 *
 * `unoptimized` because these are already 780px WebPs of 34 to 73KB: running
 * them through the image optimiser would cost a function call per visitor to
 * make them no smaller.
 */
export default function PhoneShot({
  src,
  alt,
  screen,
  className = "",
  style,
}: {
  src: StaticImageData;
  alt: string;
  /** The screen's own page colour, for the band behind the island. */
  screen: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`relative aspect-[408/906] [container-type:inline-size] ${className}`}
      style={style}
    >
      <div
        className="absolute inset-0 rounded-[15.7cqw] p-[2.2cqw]"
        style={{
          background:
            "linear-gradient(150deg,#48484c 0%,#1a1a1c 18%,#0c0c0d 55%,#2c2c2f 100%)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 40px 70px -28px rgba(0,0,0,0.7)",
        }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-[13.5cqw]"
          style={{ background: screen }}
        >
          <Image
            src={src}
            alt={alt}
            unoptimized
            loading="eager"
            draggable={false}
            className="absolute inset-x-0 bottom-0 h-auto w-full select-none"
          />
          <span
            aria-hidden
            className="absolute left-1/2 top-[2.7cqw] h-[8.3cqw] w-[29cqw] -translate-x-1/2 rounded-full bg-black"
          />
        </div>
      </div>
    </div>
  );
}
