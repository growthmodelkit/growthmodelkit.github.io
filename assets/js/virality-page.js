import { createChart } from "./chart.js";
import { bindForm, output } from "./form.js";
import { formatChange, formatCompact, formatMonth, formatMonths, formatShift } from "./format.js";

const twoDecimals = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const oneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

// "1.67", "37.5", "1.2K": fewer decimals as numbers grow
const formatUsers = (value) => (value >= 1000 ? formatCompact(value) : value >= 10 ? oneDecimal.format(value) : twoDecimals.format(value));
const formatMultiplier = (value) => `×${formatUsers(value)}`;

// Users that one new user turns into by `month`: 1 + k + k² + … + kⁿ
// after n cycles. Between cycle ends the sum runs on smoothly with a
// fractional n, so the chart has no steps.
function usersBy(month, k, cycle) {
    const n = month / cycle;
    return k === 1 ? n + 1 : (k ** (n + 1) - 1) / (k - 1);
}

// Where the multiplier stops: 1 / (1 − k) for a k-factor below 1, no limit otherwise
const limitOf = (k) => (k < 1 ? 1 / (1 - k) : Infinity);

const mauLink = document.getElementById("mau-link");
const mauNewLink = document.getElementById("mau-new-link");

const chart = createChart(document.getElementById("virality-chart"), {
    key: "users",
    yLabel: "growth multiplier",
    secondKey: "after",
    secondName: "with the lever",
    formatValue: (users) => `${formatUsers(users)} users`,
    formatX: formatMonth,
});

const change = (from, to, format) => (from === to ? format(from) : `${format(from)} → ${format(to)}`);
const formatLimit = (limit) => (Number.isFinite(limit) ? formatMultiplier(limit) : "no limit");

bindForm([document.getElementById("virality-form"), document.getElementById("levers-form")], (values) => {
    const { k, c: cycle, h: horizon } = values;
    const rows = Array.from({ length: horizon + 1 }, (_, month) => ({ month, users: usersBy(month, k, cycle) }));
    const users = rows[horizon].users;
    const limit = limitOf(k);

    output(document, "h", horizon);
    output(document, "multiplier", formatMultiplier(users));
    output(document, "limit", Number.isFinite(limit) ? formatMultiplier(limit) : "No limit: the k-factor is 1 or more");

    // Lever: the same loop with a bigger k-factor
    const newK = k * (1 + values.lk / 100);
    const newUsers = usersBy(horizon, newK, cycle);
    const newLimit = limitOf(newK);

    // The chart: the multiplier now and, dashed, with the lever
    rows.forEach((row) => { row.after = usersBy(row.month, newK, cycle); });
    const same = formatMultiplier(newUsers) === formatMultiplier(users);
    chart.update(rows, {
        labels: same
            ? [{ index: horizon, text: `baseline ${formatMultiplier(users)}`, align: "end" }]
            : [{ index: horizon, text: `baseline ${formatMultiplier(users)}`, align: "end", below: true },
               { index: horizon, text: `with the lever ${formatMultiplier(newUsers)}`, align: "end", second: true }],
        ends: ["first user", `${formatMonths(horizon)} later`],
    });
    output(document, "lever-k", change(k, newK, formatUsers));
    output(document, "effect-multiplier", formatShift(users, newUsers, formatMultiplier));
    output(document, "effect-limit", Number.isFinite(limit) && Number.isFinite(newLimit)
        ? formatShift(limit, newLimit, formatMultiplier)
        : change(limit, newLimit, formatLimit));
    // Into MAU, its lever New users per month, in percent with two decimals.
    // New users per month level off at the inflow without the loop times the
    // limit: a new loop adds the limit minus one, an improved loop the change in
    // the limit (the old loop is already in the inflow)
    const lift = (from, to) => Math.round((to / from - 1) * 10000) / 100;
    output(document, "use-new", Number.isFinite(limit) ? formatChange(1, limit) : "—");
    mauNewLink.href = Number.isFinite(limit) ? `/model/mau/?ln=${lift(1, limit)}` : "/model/mau/";
    const both = Number.isFinite(limit) && Number.isFinite(newLimit);
    output(document, "use-ln", both ? formatChange(limit, newLimit) : "—");
    mauLink.href = both ? `/model/mau/?ln=${lift(limit, newLimit)}` : "/model/mau/";
});
