import type { AnchorHTMLAttributes, MouseEvent } from 'react';

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  readonly href: string;
};

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
}

export function AppLink({ href, onClick, ...props }: AppLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      isModifiedClick(event) ||
      href.startsWith('#') ||
      typeof window === 'undefined'
    ) {
      return;
    }

    const target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin || target.protocol !== window.location.protocol) {
      return;
    }

    if (target.pathname === window.location.pathname && target.search === window.location.search) {
      return;
    }

    event.preventDefault();
    window.history.pushState({}, '', `${target.pathname}${target.search}${target.hash}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  return <a {...props} href={href} onClick={handleClick} />;
}
