import { en } from './en';

export type StringKey = keyof typeof en;
type Vars = Record<string, string | number>;

/** The launch language is undecided. Strings live in one table per locale; layout uses logical CSS only. */
export const LOCALE = 'en';
export const DIR: 'ltr' | 'rtl' = 'ltr';

const table: Record<StringKey, string> = en;
const plural = new Intl.PluralRules(LOCALE);

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : s);

export function t(key: StringKey, vars?: Vars): string {
  return fill(table[key], vars);
}

type PluralBase = { [K in StringKey]: K extends `${infer B}.one` ? B : never }[StringKey];

/** Picks `<base>.one` or `<base>.other` by the locale's plural rules; `{n}` is filled in. */
export function tp(base: PluralBase, n: number, vars?: Vars): string {
  const form = plural.select(n) === 'one' ? 'one' : 'other';
  return fill(table[`${base}.${form}` as StringKey], { n, ...vars });
}

export const formatDateLong = (iso: string): string =>
  new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${iso}T12:00:00`));
export const formatDateShort = (iso: string): string =>
  new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00:00`));
export const formatDay = (iso: string): string => new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00:00`));
export const formatMonthYear = (iso: string): string => new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' }).format(new Date(`${iso}T12:00:00`));
export const formatTimeAgo = (isoTime: string): string =>
  new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(isoTime));
