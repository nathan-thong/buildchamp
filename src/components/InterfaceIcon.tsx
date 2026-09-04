type InterfaceIconProps = {
  readonly name: 'home' | 'draft' | 'result';
};

const ICON_PATHS = {
  home: 'm4 17 8-7 8 7v7H4v-7Zm3-3V9l5-5 5 5v5',
  draft: 'M4 21h16M6 21V9h3v12m3 0V5h3v16m3 0v-9h3v9',
  result: 'M4 20h16M5 17V9m5 8V6m5 11V4m5 13v-5',
} as const;

export function InterfaceIcon({ name }: InterfaceIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d={ICON_PATHS[name]}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
