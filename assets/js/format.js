const compactShort = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const compactLong = new Intl.NumberFormat("en-US", { notation: "compact", minimumFractionDigits: 1, maximumFractionDigits: 1 });
// "500", "16.0K", "1.0M": thousands and up always with one decimal, so the
// precision of a number does not jump between "15.6K" and "16K"
const compact = { format: (value) => (Math.abs(value) >= 1000 ? compactLong : compactShort).format(value) };
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

export const formatCompact = (value) => compact.format(value);
export const formatNumber = (value) => whole.format(value);
export const formatDecimal = (value) => decimal.format(value);
const cents = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Money in US dollars: whole dollars ("$5") or with cents ("$5.30") under $100,
// compact above ("$1.2K")
export function formatMoney(value) {
    if (Math.abs(value) >= 100) return `$${compact.format(value)}`;
    const rounded = Math.round(value * 100) / 100;
    return `$${Number.isInteger(rounded) ? whole.format(rounded) : cents.format(rounded)}`;
}
export const formatPercent = (value) => percent.format(value);
export const formatMonth = (month) => `Month ${month}`;
// "1 month", "12 months"
export const formatMonths = (months) => `${months} month${months === 1 ? "" : "s"}`;

// "$5 → $5.50 (+10%)": a number before and after, with the change;
// "$5 (no change)" when it stays the same
export function formatShift(from, to, format) {
    if (from === to) return `${format(from)} (no change)`;
    const shift = `${format(from)} → ${format(to)}`;
    return from > 0 ? `${shift} (${formatChange(from, to)})` : shift;
}

// "+12.5%" / "−3%": change from `from` to `to`
export function formatChange(from, to) {
    const change = to / from - 1;
    const sign = change > 0 ? "+" : change < 0 ? "−" : "";
    return sign + percent.format(Math.abs(change));
}
