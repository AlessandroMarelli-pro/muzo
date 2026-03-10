import { User } from '@/__generated__/types';
import { useSession } from '@/lib/auth-client';
import { useUser } from '@/services/user-hooks';
import { createContext, useContext } from 'react';

export const AuthContext = createContext<
  | {
      user: User | undefined;
      isLoading: boolean;
      isAuthenticated: boolean;
    }
  | undefined
>({ user: undefined, isLoading: false, isAuthenticated: false });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, isPending: sessionLoading } = useSession();
  const isAuthenticated = !!session?.user;
  const { user, isLoading: userLoading } = useUser({ enabled: isAuthenticated });

  const isLoading = sessionLoading || (isAuthenticated && userLoading);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? undefined,
        isLoading,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a AuthProvider');
  }
  return context;
};
