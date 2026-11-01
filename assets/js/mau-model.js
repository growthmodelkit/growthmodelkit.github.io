import { lifetimeMonths, retentionCurve } from "./retention.js";

// MAU forecast for months 0..months. Month 0 is today.
// The current base is treated as mature users and loses `churn` every month.
// Every month from month 1 on brings `newUsers`, who follow the retention curve.
// `arpu` (monthly revenue per active user) is optional; revenue is MAU × arpu.
export function forecastMau({ retention, currentMau, newUsers, arpu = 0, months }) {
    const curve = retentionCurve(retention, months);
    const rows = [];
    for (let month = 0; month <= months; month++) {
        const existing = currentMau * Math.pow(1 - retention.churn, month);
        let fromNew = 0;
        for (let cohort = 1; cohort <= month; cohort++) fromNew += newUsers * curve[month - cohort];
        const mau = existing + fromNew;
        rows.push({ month, existing, fromNew, mau, revenue: mau * arpu });
    }
    return rows;
}

// Steady-state MAU with constant acquisition: each month adds newUsers who
// stay active for lifetimeMonths on average. Infinite when churn is 0.
export function mauCeiling(retention, newUsers) {
    return newUsers * lifetimeMonths(retention);
}
