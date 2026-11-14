import type { icons } from "../icons";

export type FaIcon = FaSolidIcon | FaRegularIcon | FaBrandIcon;

export type FaVariant = "solid" | "regular" | "brand";

export type FaObject =
  | {
      variant: "solid";
      icon: FaSolidIcon;
    }
  | {
      variant: "regular";
      icon: FaRegularIcon;
    }
  | {
      variant: "brand";
      icon: FaBrandIcon;
    }
  | {
      variant?: undefined;
      icon: FaSolidIcon;
    };

// Available names follow the owned, build-time SVG subset.
export type FaSolidIcon = keyof typeof icons.solid;
export type FaRegularIcon = keyof typeof icons.regular;
export type FaBrandIcon = keyof typeof icons.brand;
