export type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
  providerData: { providerId: string; email: string | null }[];
};
export type SocialProvider = "google" | "github";
