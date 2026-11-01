import { bindForm, output } from "./form.js";
import { formatChange, formatMoney, formatPercent, formatShift } from "./format.js";
import { createStacked } from "./stacked.js";

const chart = createStacked(document.getElementById("engagement-chart"), {
    names: ["Casual", "Core", "Power"],
    barNames: ["baseline", "levers"],
});

// "$2.00": always with cents, so the parts of a bar read alike; rounded as in the tables
const formatCents = (value) => (formatMoney(value).includes(".") ? formatMoney(value) : `${formatMoney(value)}.00`);

const form = document.getElementById("engagement-form");
const power = form.elements.ps;
const core = form.elements.cs;
const ltvLink = document.getElementById("ltv-link");
const mauLink = document.getElementById("mau-link");

// Power and core users together can be at most 100%; casual users are the rest.
// Over 100%, the casual share, the title and the chart would be wrong, so
// they are cleared instead of left from the last valid numbers.
const figure = document.getElementById("engagement-chart");
function checkShares() {
    const over = power.valueAsNumber + core.valueAsNumber > 100;
    core.setCustomValidity(over ? "Power and core users together can be at most 100%." : "");
    figure.hidden = over;
    if (over) output(document, "casual-share", "—");
}

// Users move one step up: each lever grows a group by its share, and the
// group below gives the users (never more than it has). Shares as fractions.
function moveUp(mix, coreLift, powerLift) {
    const toCore = Math.min(mix.core * coreLift, mix.casual);
    const afterCore = { ...mix, core: mix.core + toCore, casual: mix.casual - toCore };
    const toPower = Math.min(afterCore.power * powerLift, afterCore.core);
    return { ...afterCore, power: afterCore.power + toPower, core: afterCore.core - toPower };
}

bindForm([form, document.getElementById("levers-form")], (values) => {
    const mix = { power: values.ps / 100, core: values.cs / 100 };
    mix.casual = 1 - mix.power - mix.core;
    const arpuOf = (m) => m.power * values.pv + m.core * values.cv + m.casual * values.av;
    const coreLift = values.lc / 100;
    const powerLift = values.lp / 100;

    const coreOnly = moveUp(mix, coreLift, 0);
    const powerOnly = moveUp(mix, 0, powerLift);
    const both = moveUp(mix, coreLift, powerLift);
    const arpu = arpuOf(mix);
    const newArpu = arpuOf(both);
    const shares = (from, to) => `${formatPercent(from)} → ${formatPercent(to)}`;

    output(document, "casual-share", formatPercent(mix.casual));
    output(document, "lever-core", `core ${shares(mix.core, coreOnly.core)}`);
    output(document, "lever-power", `power ${shares(mix.power, powerOnly.power)}`);
    output(document, "effect-core", formatShift(arpu, arpuOf(coreOnly), formatMoney));
    output(document, "effect-power", formatShift(arpu, arpuOf(powerOnly), formatMoney));
    output(document, "effect-both", formatShift(arpu, newArpu, formatMoney));
    output(document, "power", shares(mix.power, both.power));
    output(document, "core", shares(mix.core, both.core));
    output(document, "casual", shares(mix.casual, both.casual));
    output(document, "arpu", formatMoney(arpu));

    // Revenue per user, now and with both levers: each part of a bar is what
    // a group adds, its share times its revenue
    const parts = (m, of) => [m.casual * of.casual, m.core * of.core, m.power * of.power];
    const revenueOf = { power: values.pv, core: values.cv, casual: values.av };
    chart.update([
        { name: "revenue per user", format: formatCents, bars: [parts(mix, revenueOf), parts(both, revenueOf)] },
    ]);

    // Into MAU and LTV: revenue per user today in Your numbers, the change from
    // both levers in their lever. Dollars and percents with two decimals
    const query = new URLSearchParams({ arpu: Math.round(arpu * 100) / 100 });
    output(document, "use-arpu", formatMoney(arpu));
    output(document, "use-la", arpu > 0 ? formatChange(arpu, newArpu) : "—");
    if (arpu > 0) query.set("la", Math.round((newArpu / arpu - 1) * 10000) / 100);
    ltvLink.href = `/model/ltv/?${query}`;
    mauLink.href = `/model/mau/?${query}`;
}, checkShares);
