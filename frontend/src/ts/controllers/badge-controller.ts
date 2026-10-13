import { JSX } from "solid-js/jsx-runtime";
import { FaSolidIcon } from "../types/font-awesome";

export type UserBadge = {
  id: number;
  name: string;
  description: string;
  icon?: FaSolidIcon;
  background?: string;
  color?: string;
  customStyle?: JSX.CSSProperties;
};

/** Display-only "none" option, never sent to the API. */
export const NO_BADGE_ID = -1;

export const badges: Record<number, UserBadge> = {
  [NO_BADGE_ID]: {
    id: NO_BADGE_ID,
    name: "none",
    description: "",
    icon: "fa-frown-open",
    color: "var(--text-color)",
    background: "var(--sub-color)",
  },
  1: {
    id: 1,
    name: "Developer",
    description: "I made this",
    icon: "fa-laptop",
    color: "white",
    customStyle: {
      animation: "rgb-bg 10s linear infinite",
      background:
        "linear-gradient(45deg in hsl longer hue, hsl(330, 90%, 30%) 0%, hsl(250, 90%, 30%) 100%)",
    },
  },
  2: {
    id: 2,
    name: "Collaborator",
    description: "I helped make this",
    icon: "fa-code",
    color: "white",
    customStyle: {
      animation: "rgb-bg 10s linear infinite",
      background:
        "linear-gradient(45deg in hsl longer hue, hsl(330, 90%, 30%) 0%, hsl(250, 90%, 30%) 100%)",
    },
  },
  4: {
    id: 4,
    name: "OG Account",
    description: "First 1000 users on the site",
    icon: "fa-baby",
    color: "var(--bg-color)",
    background: "var(--main-color)",
  },
  9: {
    id: 9,
    name: "White Hat",
    description: "Reported critical vulnerabilities on the site",
    icon: "fa-user-secret",
    color: "var(--bg-color)",
    background: "var(--main-color)",
  },
  10: {
    id: 10,
    name: "Bug Hunter",
    description: "Reported or helped track down bugs on the site",
    icon: "fa-bug",
    color: "var(--text-color)",
    background: "var(--sub-color)",
  },
  11: {
    id: 11,
    name: "Content Creator",
    description: "Verified content creator",
    icon: "fa-video",
    color: "var(--text-color)",
    background: "var(--sub-color)",
  },
  12: {
    id: 12,
    name: "Contributor",
    description: "Contributed to the site",
    icon: "fa-hands-helping",
    color: "var(--text-color)",
    background: "var(--sub-color)",
  },
  13: {
    id: 13,
    name: "Mythical",
    description: "Yes, I'm actually this fast",
    icon: "fa-rocket",
    color: "white",
    customStyle: {
      animation: "rgb-bg 10s linear infinite",
      background:
        "linear-gradient(45deg in hsl longer hue, hsl(330, 90%, 30%) 0%, hsl(250, 90%, 30%) 100%)",
    },
  },
  14: {
    id: 14,
    name: "All Year Long",
    description: "Reached a streak of 365 days",
    icon: "fa-fire",
    color: "var(--bg-color)",
    background: "var(--main-color)",
  },
};

export function getById(id: number): UserBadge | undefined {
  return badges[id];
}
