import { createChart } from "./chart.js";
import { bindForm, output } from "./form.js";
import { formatDecimal, formatMoney, formatMonths, formatPercent } from "./format.js";
import { leverScenarios, showLevers } from "./levers.js";
import { lifetimeMonths, retentionCurve } from "./retention.js";

const chart = createChart(document.getElementById("ltv-chart"), {
    key: "value",
    yLabel: "revenue per user",
    secondKey: "all",
    secondName: "with all levers",
    formatValue: formatMoney,
    formatX: (month) => `Month ${month} since acquisition`,
});

const mauLink = document.getElementById("mau-link");

bindForm([document.getElementById("ltv-form"), document.getElementById("levers-form")], (values) => {
    const retention = { plateauMonth: values.pm, plateauRetention: values.pr / 100, churn: values.ch / 100 };
    const months = values.h;
    const lifetime = lifetimeMonths(retention);
    const ltv = values.arpu === 0 ? 0 : lifetime * values.arpu;

    // Revenue from one new user, added up month by month; month 0 counts as active
    const curve = retentionCurve(retention, months);
    let sum = 0;
    const rows = curve.map((share, month) => ({ month, value: (sum += share * values.arpu) }));
    const byHorizon = rows[months].value;

    output(document, "h", months);
    output(document, "ltv", Number.isFinite(ltv) ? formatMoney(ltv) : "No limit");
    output(document, "lifetime", Number.isFinite(lifetime) ? `${formatDecimal(lifetime)} months` : "No limit");
    output(document, "ltv-h", formatMoney(byHorizon));
    output(document, "ltv-h-note", Number.isFinite(ltv) && ltv > 0 ? `(${formatPercent(byHorizon / ltv)} of LTV)` : "");
    output(document, "retention-h", formatPercent(curve[months]));

    // The chart: revenue now and, dashed, with all three levers. LTV, the
    // total over the whole lifetime, is in brackets after the end numbers
    const scenarios = leverScenarios(values);
    const all = scenarios.all;
    const allCurve = retentionCurve(all.retention, months);
    let allSum = 0;
    allCurve.forEach((share, month) => { rows[month].all = (allSum += share * all.arpu); });
    const allLtv = all.arpu === 0 ? 0 : lifetimeMonths(all.retention) * all.arpu;
    const formatLtv = (value) => (Number.isFinite(value) ? formatMoney(value) : "no limit");
    const allByHorizon = rows[months].all;
    const same = formatMoney(allByHorizon) === formatMoney(byHorizon) && formatLtv(allLtv) === formatLtv(ltv);
    const baseText = `baseline ${formatMoney(byHorizon)} (LTV ${formatLtv(ltv)})`;
    chart.update(rows, {
        labels: same
            ? [{ index: months, text: baseText, align: "end" }]
            : [{ index: months, text: baseText, align: "end", below: allByHorizon > byHorizon },
               { index: months, text: `all levers ${formatMoney(allByHorizon)} (LTV ${formatLtv(allLtv)})`, align: "end", below: allByHorizon < byHorizon, second: true }],
        ends: ["joining", `${formatMonths(months)} later`],
    });

    // Same retention, revenue and levers in the MAU calculator
    const query = new URLSearchParams({ pm: values.pm, pr: values.pr, ch: values.ch, arpu: values.arpu, h: values.h, lp: values.lp, lc: values.lc, la: values.la });
    mauLink.href = `/model/mau/?${query}`;

    showLevers(scenarios, (scenario) => (scenario.arpu === 0 ? 0 : lifetimeMonths(scenario.retention) * scenario.arpu));
});
