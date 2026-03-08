import { RouterProvider } from '@tanstack/react-router';
import { useEffect } from 'react';
//import './App.css';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './contexts/auth-context';
import { router } from './router';

function InnerApp() {
  const user = useAuth();

  return (
    <>
      <RouterProvider router={router} context={user} />
      <Toaster position="top-center" />
    </>
  );
}
function App() {
  useEffect(() => {
    sessionStorage.removeItem('isLoaded');
  }, []);
  return (
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  );
}

export default App;
