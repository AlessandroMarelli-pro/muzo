import { User } from "@/__generated__/types";
import { useUser } from "@/services/user-hooks";
import { createContext, useContext } from "react";

export const AuthContext = createContext<
  { user: User | undefined; isLoading: boolean } | undefined
>({ user: undefined, isLoading: false });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useUser();

  return (
    <AuthContext.Provider value={{ user: user ?? undefined, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within a AuthProvider");
  }
  return context;
};
