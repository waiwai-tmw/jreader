import { BookmarkX } from 'lucide-react';

export function BookmarkIcon({ className = '', isDisabled = false }: { className?: string; isDisabled?: boolean }) {
  if (isDisabled) {
    return <BookmarkX className={className} />;
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
    </svg>
  );
} 