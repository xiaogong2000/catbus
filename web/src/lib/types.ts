/** Authentication provider identifiers */
export type AuthProvider = "github" | "google" | "credentials";

/** Login region determines which auth methods are shown */
export type LoginRegion = "international" | "china";

/** Credential-based login input */
export interface CredentialsLoginInput {
  email: string;
  password: string;
}
