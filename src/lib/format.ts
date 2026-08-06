export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

export function formatBudget(min: number | null, max: number | null, note?: string | null): string {
  const ksh = (n: number) => `KSh ${n.toLocaleString("en-KE")}`;
  let base: string;
  if (min && max && min !== max) base = `${ksh(min)} – ${ksh(max)}`;
  else if (min || max) base = ksh((min ?? max) as number);
  else base = "Budget on request";
  return note ? `${base} · ${note}` : base;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

export function shortTime(iso: string): string {
  const date = new Date(iso);
  const sameDay = new Date().toDateString() === date.toDateString();
  if (sameDay) return date.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}
