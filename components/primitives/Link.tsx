import React from "react";
import NextLink from "next/link";

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children?: React.ReactNode;
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  (
    {
      children,
      href = "#",
      className = "",
      ...props
    },
    ref,
  ) => {
    const baseClasses =
      "inline-block text-neon-blue hover:underline font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neon-blue";

    const classes = `${baseClasses} ${className}`;

    const style = {
      fontFamily: "'Lexend', sans-serif",
      ...((props.style as React.CSSProperties) || {}),
    };

    // If onClick is provided, render as a regular anchor tag
    if (props.onClick) {
      return (
        <a ref={ref} href={href} className={classes} style={style} {...props}>
          {children}
        </a>
      );
    }

    // Otherwise use Next.js Link for navigation
    return (
      <NextLink href={href} className={classes} ref={ref} style={style} {...props}>
        {children}
      </NextLink>
    );
  },
);

Link.displayName = "Link";
