import { RouterProvider } from '@tanstack/react-router';
//import './App.css';
import { Toaster } from './components/ui/sonner';
import { router } from './router';

function App() {
  sessionStorage.removeItem('isLoaded');
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-center" />
    </>
  );
}

export default App;
