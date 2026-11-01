// Levers shared by the LTV and MAU calculators: improve retention at plateau,
// churn after the plateau, and revenue per active user, each by its own
// relative amount. Form inputs: lp, lc, la (percent). MAU adds one more
// lever, new users per month: input ln, and `new` in the base numbers.
import { output } from "./form.js";
import { formatMoney, formatNumber, formatPercent, formatShift } from "./format.js";

// Base numbers and the scenarios: each lever alone, then all together.
// Rates as fractions; retention at plateau stays below 100%.
export function leverScenarios(values) {
    const base = {
        retention: { plateauMonth: values.pm, plateauRetention: values.pr / 100, churn: values.ch / 100 },
        arpu: values.arpu,
        newUsers: values.new,
    };
    const plateau = Math.min(base.retention.plateauRetention * (1 + values.lp / 100), 0.999);
    const churn = base.retention.churn * (1 - values.lc / 100);
    const arpu = base.arpu * (1 + values.la / 100);
    const scenarios = {
        base,
        plateau: { ...base, retention: { ...base.retention, plateauRetention: plateau } },
        churn: { ...base, retention: { ...base.retention, churn } },
        arpu: { ...base, arpu },
        all: { ...base, retention: { ...base.retention, plateauRetention: plateau, churn }, arpu },
    };
    if (values.ln !== undefined) {
        const newUsers = base.newUsers * (1 + values.ln / 100);
        scenarios.new = { ...base, newUsers };
        scenarios.all.newUsers = newUsers;
    }
    return scenarios;
}

// Fills the levers table: new value of each lever and its effect.
// result(scenario) is the money number the page compares, e.g. LTV.
export function showLevers(scenarios, result) {
    const { base } = scenarios;
    output(document, "lever-plateau", `${formatPercent(base.retention.plateauRetention)} → ${formatPercent(scenarios.plateau.retention.plateauRetention)}`);
    output(document, "lever-churn", `${formatPercent(base.retention.churn)} → ${formatPercent(scenarios.churn.retention.churn)}`);
    output(document, "lever-arpu", `${formatMoney(base.arpu)} → ${formatMoney(scenarios.arpu.arpu)}`);
    if (scenarios.new) output(document, "lever-new", `${formatNumber(base.newUsers)} → ${formatNumber(scenarios.new.newUsers)}`);
    const from = result(base);
    for (const name of ["new", "plateau", "churn", "arpu", "all"].filter((name) => scenarios[name])) {
        const to = result(scenarios[name]);
        output(document, `effect-${name}`, Number.isFinite(from) && Number.isFinite(to) ? formatShift(from, to, formatMoney) : "No limit");
    }
}
