export interface UserProfile {
  id: string;
  displayName: string | null;
  name: {
    familyName: string | null;
    givenName: string | null;
  } | null;
  emails: Array<{
    value: string;
    verified: boolean;
  }> | null;
  photos: Array<{
    value: string;
  }> | null;
  provider: string;
  _raw: string;
  _json: any;
}

export interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  checkUserLoggedIn: () => Promise<void>;
}

export interface AuthProviderProps {
  children: React.ReactNode;
}