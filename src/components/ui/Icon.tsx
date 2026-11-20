import type { ReactNode } from "react";
import styles from "./Icon.module.css";

const sidebarOutline = (
  <g strokeWidth="1.5" strokeLinecap="butt">
    <path d="M2.75 6.75C2.75 5.64543 3.64543 4.75 4.75 4.75H19.25C20.3546 4.75 21.25 5.64543 21.25 6.75V17.25C21.25 18.3546 20.3546 19.25 19.25 19.25H4.75C3.64543 19.25 2.75 18.3546 2.75 17.25V6.75Z" />
    <path d="M8.25 5V12V19" />
  </g>
);

const paths = {
  sidebar: sidebarOutline,
  sidebarOpen: (
    <>
      <path
        d="M8.25 4.75v14.5h-3.5a2 2 0 0 1-2-2V6.75a2 2 0 0 1 2-2Z"
        fill="currentColor"
        stroke="none"
      />
      {sidebarOutline}
    </>
  ),
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  send: <path d="M12 20V5m-6 6 6-6 6 6" />,
  back: <path d="M20 12H5m6-6-6 6 6 6" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  pencil: <path d="M4 20l4.5-1L20 7.5a2.8 2.8 0 0 0-4-4L4.5 15 4 20ZM14.5 5l4 4" />,
  copy: (
    <path
      d="M7.75 7.75V5.75C7.75 4.64543 8.64543 3.75 9.75 3.75H18.25C19.3546 3.75 20.25 4.64543 20.25 5.75V14.26C20.25 15.3646 19.3546 16.26 18.25 16.26H16.25M3.75 9.75V18.25C3.75 19.3546 4.64543 20.25 5.75 20.25H14.25C15.3546 20.25 16.25 19.3546 16.25 18.25V9.75C16.25 8.64543 15.3546 7.75 14.25 7.75H5.75C4.64543 7.75 3.75 8.64543 3.75 9.75Z"
      strokeWidth="1.5"
    />
  ),
  check: <path d="m5 12 4 4L19 6" />,
  circleCheck: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.3 2.4 4.7-5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5" />
    </>
  ),
  tasks: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  sparkles: (
    <>
      <path d="M9 3c0 4-2 6-6 6 4 0 6 2 6 6 0-4 2-6 6-6-4 0-6-2-6-6Zm8 9c0 3-1 5-4 5 3 0 4 2 4 5 0-3 2-5 5-5-3 0-5-2-5-5Z" />
      <path d="M19 3v4m-2-2h4" />
    </>
  ),
  question: (
    <>
      <path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.9-.9L4 20l1-3.8a8.5 8.5 0 1 1 15.5-4.7Z" />
      <path d="M10 9.5a2.1 2.1 0 1 1 3.3 1.7c-.8.6-1.3 1-1.3 2m0 2.7h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s7-3.5 7-10V6l-7-3-7 3v6c0 6.5 7 10 7 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  answers: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  work: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V4h8v3M3 12l4 2h10l4-2m-9 0v3" />
    </>
  ),
  contract: (
    <>
      <path d="M6 3h8l4 4v13H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5M8.5 12h6m-6 4h6" />
    </>
  ),
  business: (
    <>
      <path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10c0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0M10 20v-5h4v5" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r=".65" />
      <circle cx="12" cy="12" r=".65" />
      <circle cx="19" cy="12" r=".65" />
    </>
  ),
  pregnant: (
    <>
      <path d="M7 21c-2-3-2-5-.5-8 1.6-3.3.5-4.4.5-6V3h5c1 1 .7 2 1.2 2.4.7.6 1.4.6 1.4 1.6 0 1-.9 2-1.6 2.5 4.5 1.7 6 4 6 6.6A5 5 0 0 1 14 21" />
      <path
        d="M12 14c-1.2-1.1-3 .4-1.3 2l1.3 1.1 1.3-1.1c1.7-1.6-.1-3.1-1.3-2Z"
        fill="currentColor"
        strokeWidth="1"
      />
    </>
  ),
  baby: (
    <>
      <path d="M12 3C7 3 5 7 5 12s2.5 9 7 9 7-4 7-9-2-9-7-9Z" />
      <path d="M5 11c3 3 8 6 12 6M7 19c2.5-3 6.5-4 11.5-8M8 8.5h.01m2.5 2.3q1.5 1.4 3 0M16 8.5h.01M11 3q-1 3 1.5 3" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({ name, size = "md" }: { name: IconName; size?: "sm" | "md" }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={styles.icon}
      data-size={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
