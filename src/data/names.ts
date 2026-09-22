import raw from "./names.json";
import type { BabyName } from "../types/name";

export const NAMES: BabyName[] = raw as BabyName[];

export const NAMES_BY_ID: Map<string, BabyName> = new Map(
  NAMES.map((n) => [n.id, n])
);

export function getNameById(id: string): BabyName | undefined {
  return NAMES_BY_ID.get(id);
}
