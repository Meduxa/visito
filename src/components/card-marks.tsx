// Visa and Mastercard acceptance marks, shown where Visito sells its plans
// (required by card payment providers). Their own brand colours are part of the
// marks, so they are kept here instead of in our design tokens.
export function CardMarks({ className }: { className?: string }) {
  return (
    <span className={className} role="img" aria-label="Visa, Mastercard">
      <svg viewBox="0 0 48 30" className="h-6 w-auto" aria-hidden>
        <rect width="48" height="30" rx="4" fill="#ffffff" stroke="#d4d8dd" />
        <text
          x="24"
          y="20"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="13"
          fontWeight="700"
          fontStyle="italic"
          fill="#1a1f71"
        >
          VISA
        </text>
      </svg>
      <svg viewBox="0 0 48 30" className="h-6 w-auto" aria-hidden>
        <rect width="48" height="30" rx="4" fill="#ffffff" stroke="#d4d8dd" />
        <circle cx="19" cy="15" r="8" fill="#eb001b" />
        <circle cx="29" cy="15" r="8" fill="#f79e1b" />
        <path d="M24 8.6a8 8 0 0 1 0 12.8 8 8 0 0 1 0-12.8z" fill="#ff5f00" />
      </svg>
    </span>
  );
}
