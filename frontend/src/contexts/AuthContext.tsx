import axios, { AxiosError } from "axios";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "../api";
import { AuthProviderProps, UserProfile } from "../types/auth";

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const setAuthState = useCallback((newState: Partial<AuthState>) => {
    setState((prev) => ({ ...prev, ...newState }));
  }, []);

  const validateToken = useCallback(async (token: string) => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const { data } = await api.post<UserProfile>("/auth/validate_token", {
        token,
      });

      // Store user data in localStorage for persistence
      localStorage.setItem("pax_user", JSON.stringify(data));
      localStorage.setItem("pax_auth_time", Date.now().toString());

      setState({ user: data, loading: false, error: null });
      return data;
    } catch (error) {
      console.error("Token validation failed:", error);
      localStorage.removeItem("pax_user");
      localStorage.removeItem("pax_auth_time");
      setState({ user: null, loading: false, error: null });
      return null;
    }
  }, []);

  const checkUserLoggedIn = useCallback(async () => {
    // First check if there's a token in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (token) {
      // Clear the token from URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("token");
      window.history.replaceState({}, "", newUrl.toString());

      // Validate the token
      return await validateToken(token);
    }

    // Check localStorage for persisted user data
    const storedUser = localStorage.getItem("pax_user");
    const storedAuthTime = localStorage.getItem("pax_auth_time");

    if (storedUser && storedAuthTime) {
      const authTime = parseInt(storedAuthTime);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      // Check if stored auth is still valid (not expired)
      if (now - authTime < maxAge) {
        try {
          const userData = JSON.parse(storedUser);
          setState({ user: userData, loading: false, error: null });
          return userData;
        } catch (error) {
          console.error("Error parsing stored user data:", error);
          localStorage.removeItem("pax_user");
          localStorage.removeItem("pax_auth_time");
        }
      } else {
        // Auth expired, clear localStorage
        localStorage.removeItem("pax_user");
        localStorage.removeItem("pax_auth_time");
      }
    }

    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const { data } = await api.get<UserProfile>("/auth/current_user");

      // Check if the response is an empty object or has no user data
      const isValidUser =
        data &&
        typeof data === "object" &&
        Object.keys(data).length > 0 &&
        data.id;

      if (isValidUser) {
        setState({ user: data, loading: false, error: null });
        return data;
      } else {
        setState({ user: null, loading: false, error: null });
        return null;
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      // Don't treat 401 as an error - it just means user is not logged in
      if (axiosError.response?.status !== 401) {
        console.error("Authentication check failed:", axiosError.message);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to check authentication status",
        }));
      } else {
        setState({ user: null, loading: false, error: null });
      }
      return null;
    }
  }, [validateToken]);

  const login = useCallback(() => {
    // Store the current path to redirect back after login
    const returnTo = window.location.pathname;
    const backendUrl = process.env.REACT_APP_API_URL || "http://localhost:5001";
    const authUrl = `${backendUrl}/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.href = authUrl;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      await axios.post("/auth/logout");

      // Clear localStorage
      localStorage.removeItem("pax_user");
      localStorage.removeItem("pax_auth_time");

      setState({ user: null, loading: false, error: null });
      // Don't redirect here - let the component handle the redirect
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error("Logout failed:", axiosError.message);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to log out. Please try again.",
      }));
      // Even if logout fails, clear the user from state
      setState((prev) => ({ ...prev, user: null }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Initial auth check
  useEffect(() => {
    checkUserLoggedIn();
  }, [checkUserLoggedIn]);

  const value: AuthContextType = {
    ...state,
    isAuthenticated: !!(
      state.user &&
      typeof state.user === "object" &&
      Object.keys(state.user).length > 0
    ),
    login,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
