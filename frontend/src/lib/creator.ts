// Authorship of the app, in one place so the credit reads identically wherever
// it appears.
//
// Fill a URL below and its icon lights up on its own; leave one blank and it is
// simply not rendered, so the credit never shows a dead link.

export const CREATOR = {
  prefix: "Crafted by",
  name: "Nikhil Balamurugan",
  links: {
    linkedin: "https://www.linkedin.com/in/nikhilb21/",
    instagram: "https://www.instagram.com/nikhiiiiiillllll/",
    github: "https://github.com/Nikhil210206",
  },
} as const;

export type CreatorLinkKind = keyof typeof CREATOR.links;

/** How each link is named to a screen reader and on a labelled button. */
export const LINK_NAMES: Record<CreatorLinkKind, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  github: "GitHub",
};

export function creatorLinks(): { kind: CreatorLinkKind; url: string }[] {
  return (Object.keys(CREATOR.links) as CreatorLinkKind[])
    .filter((kind) => Boolean(CREATOR.links[kind]))
    .map((kind) => ({ kind, url: CREATOR.links[kind] }));
}
