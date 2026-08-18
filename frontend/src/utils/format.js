export function formatCurrency(n) {
  const v = Number(n) || 0;
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function formatDate(d) {
  if (!d) return "—";
  const dt = new Date(String(d).slice(0, 10) + "T00:00:00");
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return (
    dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " +
    dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  );
}

// "5 min ago" / "2 hours ago" / "Yesterday" / falls back to an absolute date beyond a
// week out, since "23 days ago" stops being more readable than the actual date.
export function formatRelativeTime(iso) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "—";

  const diffMs = Date.now() - dt.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (dt >= startOfYesterday && dt < startOfToday) return "Yesterday";

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;

  return formatDateTime(iso);
}

export function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let size = n / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[i]}`;
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(dateStr, days) {
  const dt = new Date(dateStr + "T00:00:00");
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}
