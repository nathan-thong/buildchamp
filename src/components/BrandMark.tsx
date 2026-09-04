type BrandMarkProps = {
  readonly className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 44 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 8.5 11.5 15 15.5 4l6.5 8 6.5-8 4 11L40 8.5v18.25c0 1.8-1.45 3.25-3.25 3.25H7.25A3.25 3.25 0 0 1 4 26.75V8.5Z"
        fill="currentColor"
      />
      <path d="M6 32h32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12 27v5M32 27v5" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}
