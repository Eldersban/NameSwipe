import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export function IconDiscover(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.8 9.2l-2 5.6-5.6 2 2-5.6z" />
    </svg>
  );
}

export function IconList(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth="2.6" />
    </svg>
  );
}

export function IconInsights(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 19V10M11 19V5M18 19v-7" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13a7.7 7.7 0 000-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-1.7-1L15 3h-4l-.3 2.5a7.6 7.6 0 00-1.7 1l-2.4-1-2 3.4L6.6 11a7.7 7.7 0 000 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 001.7 1L11 21h4l.3-2.5a7.6 7.6 0 001.7-1l2.4 1 2-3.4z" />
    </svg>
  );
}

export function IconHeart(props: IconProps & { filled?: boolean }) {
  const { filled, ...rest } = props;
  return (
    <svg {...base} fill={filled ? "currentColor" : "none"} {...rest}>
      <path d="M12 20.5s-7.5-4.7-9.9-9.3C.5 8 2 4.5 5.5 4c2-.3 3.7.6 4.9 2.2 1.1-1.6 2.9-2.5 4.9-2.2 3.5.5 5 4 3.4 7.2-2.4 4.6-9.9 9.3-9.9 9.3z" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export function IconChevronUp(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 15l7-7 7 7" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function IconUndo(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 14l-4-4 4-4" />
      <path d="M5 10h9a5 5 0 015 5v0a5 5 0 01-5 5h-3" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
    </svg>
  );
}

export function IconSparkle(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 14.5A8.5 8.5 0 119.5 4a7 7 0 0010.5 10.5z" />
    </svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v13M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function IconUpload(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20V7M7 12l5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function IconFlame(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21c-4 0-6.5-2.7-6.5-6 0-2.6 1.6-4.3 2.3-6 .4 1.3 1.2 2.1 2 2.1-.3-2.6.7-5.3 3-7.1.2 2 1 3.4 2.3 4.8 1.6 1.7 3 3.4 3 6.2 0 3.3-2.6 6-6.1 6z" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
    </svg>
  );
}

export function IconTrophy(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 4h10v5a5 5 0 01-10 0z" />
      <path d="M7 5H4a3 3 0 003 5M17 5h3a3 3 0 01-3 5" />
      <path d="M12 14v3M9 21h6M9.5 21c0-2 1-3 2.5-3s2.5 1 2.5 3" />
    </svg>
  );
}

export function IconArrowLeft(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}
