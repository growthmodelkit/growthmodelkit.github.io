// Retention curve: share of a cohort still active t months after acquisition.
// Month 0 is the acquisition month (100%). Until the plateau month the curve
// decays as a power law, r(t) = (1 + t)^-b, with b fitted so that r(plateau)
// equals the plateau retention. After the plateau users leave at a constant
// monthly churn: r(t) = r(plateau) * (1 - churn)^(t - plateau).
//
// params: { plateauMonth, plateauRetention, churn }, rates as fractions (0.4 = 40%)

export function powerExponent({ plateauMonth, plateauRetention }) {
    return -Math.log(plateauRetention) / Math.log(1 + plateauMonth);
}

export function retentionAt(t, params) {
    const { plateauMonth, plateauRetention, churn } = params;
    if (t <= plateauMonth) return Math.pow(1 + t, -powerExponent(params));
    return plateauRetention * Math.pow(1 - churn, t - plateauMonth);
}

// Retention for months 0..months
export function retentionCurve(params, months) {
    return Array.from({ length: months + 1 }, (_, t) => retentionAt(t, params));
}

// Expected number of active months per acquired user: the sum of r(t) over
// all months. The tail after the plateau is a geometric series, plateau / churn.
// Infinite when churn is 0.
export function lifetimeMonths(params) {
    const { plateauMonth, plateauRetention, churn } = params;
    if (churn <= 0) return Infinity;
    let sum = 0;
    for (let t = 0; t < plateauMonth; t++) sum += retentionAt(t, params);
    return sum + plateauRetention / churn;
}
