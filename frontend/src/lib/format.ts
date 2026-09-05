import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import relativeTime from "dayjs/plugin/relativeTime";
import calendar from "dayjs/plugin/calendar";

dayjs.extend(relativeTime);
dayjs.extend(calendar);
dayjs.locale("pt-br");

export function formatTime(iso: string): string {
  return dayjs(iso).format("HH:mm");
}

export function formatListTime(iso: string): string {
  const d = dayjs(iso);
  const now = dayjs();
  if (d.isSame(now, "day")) return d.format("HH:mm");
  if (d.isSame(now.subtract(1, "day"), "day")) return "Ontem";
  if (d.isSame(now, "week")) return d.format("ddd");
  return d.format("DD/MM/YY");
}

export function formatDateHeader(iso: string): string {
  const d = dayjs(iso);
  const now = dayjs();
  if (d.isSame(now, "day")) return "Hoje";
  if (d.isSame(now.subtract(1, "day"), "day")) return "Ontem";
  return d.format("DD [de] MMMM");
}

export function formatDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
