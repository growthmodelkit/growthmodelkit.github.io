import { createChart } from "./chart.js";
import { bindForm, output } from "./form.js";
import { formatChange, formatCompact, formatMoney, formatMonth, formatMonths, formatNumber, formatPercent, formatShift } from "./format.js";
import { leverScenarios, showLevers } from "./levers.js";
import { forecastMau, mauCeiling } from "./mau-model.js";

const mauChart = createChart(document.getElementById("mau-chart"), {
    key: "mau",
    yLabel: "MAU",
    secondKey: "all",
    secondName: "with all levers",
    formatValue: formatNumber,
    formatX: formatMonth,
});

const ltvLink = document.getElementById("ltv-link");

bindForm([document.getElementById("mau-form"), document.getElementById("levers-form")], (values) => {
    const retention = { plateauMonth: values.pm, plateauRetention: values.pr / 100, churn: values.ch / 100 };
    const months = values.h;
    const rows = forecastMau({ retention, currentMau: values.mau, newUsers: values.new, arpu: values.arpu, months });
    const first = rows[0];
    const last = rows[months];
    const ceiling = mauCeiling(retention, values.new);
    const change = (from, to) => (from > 0 ? `(${formatChange(from, to)} vs now)` : "");

    output(document, "h", months);
    output(document, "mau-end", formatCompact(last.mau));
    output(document, "mau-change", change(first.mau, last.mau));
    output(document, "revenue-end", formatMoney(last.revenue));
    output(document, "revenue-change", change(first.revenue, last.revenue));
    output(document, "revenue-total", formatMoney(rows.slice(1).reduce((sum, row) => sum + row.revenue, 0)));

    if (!Number.isFinite(ceiling)) {
        output(document, "ceiling", "No limit");
        output(document, "ceiling-note", "(zero churn: MAU keeps growing)");
    } else if (ceiling === 0) {
        output(document, "ceiling", "0");
        output(document, "ceiling-note", last.mau > 0 ? "(no new users: MAU shrinks to zero)" : "(no new users)");
    } else if (first.mau > ceiling) {
        output(document, "ceiling", formatCompact(ceiling));
        output(document, "ceiling-note", "(MAU is above the ceiling and falls toward it)");
    } else {
        output(document, "ceiling", formatCompact(ceiling));
        output(document, "ceiling-note", `(${formatPercent(last.mau / ceiling)} reached in month ${months})`);
    }

    // The chart: MAU now and, dashed, with all four levers. The ceilings are
    // in brackets after the end numbers, not lines: three lines would be too many
    const scenarios = leverScenarios(values);
    const allRows = forecastMau({ retention: scenarios.all.retention, currentMau: values.mau, newUsers: scenarios.all.newUsers, arpu: scenarios.all.arpu, months });
    rows.forEach((row, i) => { row.all = allRows[i].mau; });
    const allLast = allRows[months].mau;
    const allCeiling = mauCeiling(scenarios.all.retention, scenarios.all.newUsers);
    const formatCeiling = (value) => (Number.isFinite(value) ? formatCompact(value) : "no limit");
    // Key numbers: MAU at the end of the horizon on both lines, the lower one
    // under its point
    const same = formatCompact(allLast) === formatCompact(last.mau) && formatCeiling(allCeiling) === formatCeiling(ceiling);
    const baseText = `baseline ${formatCompact(last.mau)} (ceiling ${formatCeiling(ceiling)})`;
    mauChart.update(rows, {
        labels: same
            ? [{ index: months, text: baseText, align: "end" }]
            : [{ index: months, text: baseText, align: "end", below: allLast > last.mau },
               { index: months, text: `all levers ${formatCompact(allLast)} (ceiling ${formatCeiling(allCeiling)})`, align: "end", below: allLast < last.mau, second: true }],
        ends: ["now", `in ${formatMonths(months)}`],
    });

    // Same retention, revenue and levers in the LTV calculator
    const query = new URLSearchParams({ pm: values.pm, pr: values.pr, ch: values.ch, arpu: values.arpu, h: values.h, lp: values.lp, lc: values.lc, la: values.la });
    ltvLink.href = `/model/ltv/?${query}`;

    // Levers compare total revenue over the horizon, and MAU at its end
    const forecast = ({ retention, arpu, newUsers }) => forecastMau({ retention, currentMau: values.mau, newUsers, arpu, months });
    const total = (scenario) => forecast(scenario).slice(1).reduce((sum, row) => sum + row.revenue, 0);
    showLevers(scenarios, total);
    for (const name of ["new", "plateau", "churn", "arpu", "all"]) {
        const mau = forecast(scenarios[name])[months].mau;
        output(document, `mau-${name}`, formatShift(last.mau, mau, formatCompact));
        // The ceiling with the lever; with no ceiling (zero churn) on either
        // side there is no share to show
        const newCeiling = mauCeiling(scenarios[name].retention, scenarios[name].newUsers);
        output(document, `ceiling-${name}`, Number.isFinite(ceiling) && Number.isFinite(newCeiling)
            ? formatShift(ceiling, newCeiling, formatCompact)
            : formatCeiling(ceiling) === formatCeiling(newCeiling) ? formatCeiling(ceiling) : `${formatCeiling(ceiling)} → ${formatCeiling(newCeiling)}`);
    }
});
