/**
 * The CONNEX mark: two strokes crossing between four nodes, one of them lit.
 * Four signals meet in the middle and leave as one token. Ink follows
 * currentColor; the lit node is the signal colour.
 */
export function Mark({ size = 24, className = "", lit = "var(--signal)" }: { size?: number; className?: string; lit?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M7.5 7.5 24.5 24.5M24.5 7.5 7.5 24.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="7.5" cy="7.5" r="4.5" fill="currentColor" />
      <circle cx="7.5" cy="24.5" r="4.5" fill="currentColor" />
      <circle cx="24.5" cy="24.5" r="4.5" fill="currentColor" />
      <circle cx="24.5" cy="7.5" r="4.5" fill={lit} />
    </svg>
  );
}
