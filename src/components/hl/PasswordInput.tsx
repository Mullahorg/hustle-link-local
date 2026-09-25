import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Password field with a large show/hide toggle, easy to hit with a thumb. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("h-14 rounded-2xl border-2 pr-14 text-base font-semibold", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 grid size-12 -translate-y-1/2 place-items-center rounded-xl text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
      </button>
    </div>
  );
}

/** Plain-language strength hint instead of a colour bar. */
export function passwordHint(value: string): string {
  if (!value) return "At least 8 characters. A short sentence is easy to remember.";
  if (value.length < 8) return `${8 - value.length} more character${value.length === 7 ? "" : "s"} needed.`;
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(value)).length;
  if (value.length >= 12 || kinds >= 3) return "Strong password.";
  return "Good. Adding a number or a longer phrase makes it stronger.";
}
