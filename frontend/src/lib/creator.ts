// Authorship of the app, in one place so the credit reads identically wherever
// it appears.
//
// Fill the two URLs below and the social icons light up on their own; leave one
// blank and it is simply not rendered, so the credit never shows a dead link.

export const CREATOR = {
  prefix: "Crafted by",
  name: "Nikhil Balamurugan",
  links: {
    linkedin: "https://www.linkedin.com/in/nikhilb21/",
    instagram: "https://www.instagram.com/nikhiiiiiillllll/",
  },
} as const;

export function creatorLinks(): { kind: "linkedin" | "instagram"; url: string }[] {
  const out: { kind: "linkedin" | "instagram"; url: string }[] = [];
  if (CREATOR.links.linkedin) out.push({ kind: "linkedin", url: CREATOR.links.linkedin });
  if (CREATOR.links.instagram)
    out.push({ kind: "instagram", url: CREATOR.links.instagram });
  return out;
}
