import { createContext } from "react";
import type { AuthState } from "./auth";

// Keep context identity independent of the provider's Fast Refresh lifecycle.
export const AuthContext = createContext<AuthState | null>(null);