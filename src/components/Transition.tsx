import type { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      {children}
    </div>
  );
}
