import { createChart } from "./chart.js";
import { bindForm, output } from "./form.js";
import { formatChange, formatPercent, formatShift } from "./format.js";

// Retention (at the plateau) of all new users: a mix of activated and other users
const mix = (share, activated, others) => share * activated + (1 - share) * others;

const chart = createChart(document.getElementById("activation-chart"), {
    key: "plateau",
    yLabel: "retention",
    formatValue: formatPercent,
    formatX: (share) => `${share}% activate`,
});

const ltvLink = document.getElementById("ltv-link");
const mauLink = document.getElementById("mau-link");


bindForm([document.getElementById("activation-form"), document.getElementById("levers-form")], (values) => {
    const activated = values.ra / 100;
    const others = values.rn / 100;
    const share = values.a / 100;
    const plateau = mix(share, activated, others);

    output(document, "plateau", formatPercent(plateau));

    // Lever: a bigger share of activated users, each group keeps its retention
    const newShare = Math.min(share * (1 + values.lift / 100), 1);
    const newPlateau = mix(newShare, activated, others);

    // The chart runs over every share from 0% to 100%, with two points on it:
    // the share now and the share with the lever
    const rows = Array.from({ length: 101 }, (_, s) => ({ month: s, plateau: mix(s / 100, activated, others) }));
    const now = Math.round(share * 100);
    const after = Math.round(newShare * 100);
    // Each label away from the other point and off the line: the baseline left
    // of its point, the lever right of its point; on a rising line the
    // baseline over the line and the lever under it, on a falling line the
    // other way
    const up = activated >= others;
    const nowLabel = { index: now, text: `baseline ${formatPercent(rows[now].plateau)}`, align: "end", below: !up };
    chart.update(rows, {
        labels: after === now
            ? [nowLabel]
            : [nowLabel, { index: after, text: `with the lever ${formatPercent(newPlateau)}`, below: up }],
        ends: ["0% activate", "100% activate"],
    });
    output(document, "lever-share", `${formatPercent(share)} → ${formatPercent(newShare)}`);
    output(document, "effect-plateau", formatShift(plateau, newPlateau, formatPercent));

    // Into MAU and LTV: retention today in Your numbers, the change
    // from the lever in their lever Retention. Retention in percent
    // with one decimal, the change with two
    const pr = Math.min(Math.max(Math.round(plateau * 1000) / 10, 0.1), 99.9);
    output(document, "use-pr", formatPercent(pr / 100));
    const query = new URLSearchParams({ pr });
    if (plateau > 0) {
        const lp = Math.round((newPlateau / plateau - 1) * 10000) / 100;
        output(document, "use-lp", formatChange(plateau, newPlateau));
        query.set("lp", lp);
    } else {
        output(document, "use-lp", "—");
    }
    ltvLink.href = `/model/ltv/?${query}`;
    mauLink.href = `/model/mau/?${query}`;
});
