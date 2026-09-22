export type NameStyle =
  | "classic"
  | "vintage"
  | "modern"
  | "biblical"
  | "literary"
  | "nature"
  | "international"
  | "surname-style"
  | "short-punchy"
  | "strong"
  | "soft"
  | "rare"
  | "invented";

export type PopularityTier = "very-common" | "common" | "uncommon" | "rare";

export interface Nickname {
  name: string;
  tag?: "common" | "modern" | "traditional" | "international" | "uncommon";
}

export interface BabyName {
  id: string;
  name: string;
  gender: "boy";

  nicknames: Nickname[];

  origins: string[];
  meaning: string;

  syllables: number;
  firstLetter: string;
  lastLetter: string;

  styles: NameStyle[];
  traits: string[];

  popularityTier: PopularityTier;

  similarNameIds: string[];
}

export type Disposition = "yes" | "maybe" | "no";

export type RejectionReason =
  | "taste"
  | "family"
  | "friend"
  | "taken"
  | "association"
  | "surname_fit"
  | "partner_veto"
  | "other";

export const REJECTION_REASONS: { value: RejectionReason; label: string }[] = [
  { value: "taste", label: "Don't like it" },
  { value: "family", label: "Family" },
  { value: "friend", label: "Friend" },
  { value: "taken", label: "Already taken" },
  { value: "association", label: "Bad association" },
  { value: "surname_fit", label: "Doesn't work with surname" },
  { value: "other", label: "Other" },
];

/** Reasons that reflect availability, not taste — should NOT push recommendations away from this style. */
export const AVAILABILITY_REASONS: RejectionReason[] = [
  "family",
  "friend",
  "taken",
  "partner_veto",
];

export interface UserNameState {
  nameId: string;
  disposition: Disposition;
  liked: boolean;
  rejectionReason?: RejectionReason;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionHistoryEntry {
  nameId: string;
  previous: UserNameState | undefined;
}
