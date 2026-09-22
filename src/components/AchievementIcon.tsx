import type { SVGProps } from "react";
import type { Achievement } from "../types/gamification";
import {
  IconSparkle,
  IconInsights,
  IconList,
  IconCheck,
  IconHeart,
  IconUndo,
  IconSearch,
  IconMoon,
  IconSun,
  IconFlame,
  IconTrophy,
} from "./Icons";

const ICON_MAP: Record<Achievement["icon"], (props: SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  sparkle: IconSparkle,
  insights: IconInsights,
  list: IconList,
  check: IconCheck,
  heart: (props) => <IconHeart filled {...props} />,
  heartOutline: IconHeart,
  undo: IconUndo,
  search: IconSearch,
  moon: IconMoon,
  sun: IconSun,
  flame: IconFlame,
  trophy: IconTrophy,
};

export function AchievementIcon({
  icon,
  ...props
}: { icon: Achievement["icon"] } & SVGProps<SVGSVGElement>) {
  const Comp = ICON_MAP[icon];
  return <Comp {...props} />;
}
