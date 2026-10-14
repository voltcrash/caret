import { type ClientProfile } from "../../db/client-profile";

import { type LbPersonalBests } from "../../utils/pb";

import type {
  CustomTheme,
  MonkeyMail,
  ResultFilters,
  UserTag,
  User,
  CountByYearAndDay,
} from "@oxytype/schemas/users";
import type { Client } from "@oxytype/schemas/shared";

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
  clientProfiles?: Partial<Record<Client, ClientProfile>>;
  resultFilterPresets?: ResultFilters[];
  tags?: DBUserTag[];
  lbPersonalBests?: LbPersonalBests;
  customThemes?: CustomTheme[];
  autoBanTimestamps?: number[];
  lastTimingHashes?: string[];
  inbox?: MonkeyMail[];
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
