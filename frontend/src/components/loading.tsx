import { RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

export const Loading = () => {
  return (
    <div className="text-center  flex flex-col items-center justify-center h-[100vh] w-full">
      <div className="flex items-center justify-between ">
        <Button variant="outline" disabled>
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          Loading...
        </Button>
      </div>
    </div>
  );
};
