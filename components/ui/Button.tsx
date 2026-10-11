"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "accent";

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-slate-900 text-white border border-slate-900 hover:bg-slate-800",
  secondary: "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50",
  accent: "bg-blue-600 text-white border border-blue-600 hover:bg-blue-700",
};

/** Shared action-button style: semibold label, explicit color, WCAG AA on white. */
export function buttonClass(variant: ButtonVariant = "secondary", extra = "") {
  return `inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold leading-snug transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClass[variant]} ${extra}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export default function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "secondary",
  className = "",
  children,
  target,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
  target?: string;
}) {
  return (
    <Link href={href} target={target} rel={target === "_blank" ? "noopener noreferrer" : undefined} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}
