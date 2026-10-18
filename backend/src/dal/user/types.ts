import { type LbPersonalBests } from "../../utils/pb";

import type {
  CustomTheme,
  ResultFilters,
  UserTag,
  User,
  CountByYearAndDay,
} from "@oxytype/schemas/users";

export type DBUserTag = UserTag;

export type DBUser = Omit<
  User,
  | "resultFilterPresets"
  | "tags"
  | "customThemes"
  | "isPremium"
  | "allTimeLbs"
  | "testActivity"
> & {
  _id: string;
  resultFilterPresets?: ResultFilters[];
  tags?: DBUserTag[];
  lbPersonalBests?: LbPersonalBests;
  customThemes?: CustomTheme[];
  autoBanTimestamps?: number[];
  lastTimingHashes?: string[];
  ips?: string[];
  canReport?: boolean;
  nameHistory?: string[];
  lastNameChange?: number;
  canManageApeKeys?: boolean;
  bananas?: number;
  testActivity?: CountByYearAndDay;
  suspicious?: boolean;
  note?: string;
};

export type DBCustomTheme = CustomTheme;
