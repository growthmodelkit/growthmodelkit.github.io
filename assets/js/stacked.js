// Stacked bars, before and after: panels side by side (one under another on a
// narrow screen), each with two bars, e.g. "baseline" and "levers". A bar is
// a total, written over it; its parts are what each group adds to it. Parts
// from the bottom up in the order given; black and white fills tell them
// apart: empty, hatched, black. Each part of the second bar is named on its
// right with its value.
// Plain SVG; all text in the page font at the page size (style.css).
//
// Markup it expects inside the figure:
//   .chart-plot    the SVG goes here
const SVG_NS = "http://www.w3.org/2000/svg";
// Sizes at a 16px page font; they grow with the page font
const BARS = 120;        // height of the tallest bar
const BAR = 40;          // bar width
const BAR_GAP = 40;      // between the two bars: room for their names under them
const PANEL_GAP = 24;    // between panels side by side

function svg(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    parent.append(el);
    return el;
}

// options:
//   names     group names, from the bottom part up
//   barNames  names under the two bars, e.g. ["baseline", "levers"]
export function createStacked(figure, { names, barNames }) {
    const plot = figure.querySelector(".chart-plot");
    let panels = [];
    let svgEl = null;

    function draw() {
        const width = plot.clientWidth;
        if (!width || panels.length === 0) return;
        const size = parseFloat(getComputedStyle(figure).fontSize) || 16;
        const [bars, bar, barGap, panelGap] = [BARS, BAR, BAR_GAP, PANEL_GAP].map((px) => (px * size) / 16);
        const line = 1.25 * size;

        svgEl?.remove();
        svgEl = document.createElementNS(SVG_NS, "svg");
        plot.prepend(svgEl);

        // Colours go into attributes, where var() does not work
        const ink = getComputedStyle(figure).getPropertyValue("--ink").trim();
        const text = (content, tx, ty, anchor = "start") => {
            const el = svg("text", { x: tx, y: ty, "text-anchor": anchor, fill: ink }, svgEl);
            el.textContent = content;
            return el;
        };

        // The part labels set the panel width: the longest one after the bars
        const labelsOf = (panel) => panel.bars[1].map((value, g) => `${names[g]} ${panel.format(value)}`);
        const labelWidth = Math.max(...panels.flatMap(labelsOf).map((content) => {
            const el = text(content, 0, 0);
            const w = el.getComputedTextLength();
            el.remove();
            return w;
        }));
        // A bar name wider than its bar sticks out on both sides: the bars move
        // right so that the first name starts at the left edge
        const nameWidth = (() => {
            const el = text(barNames[0], 0, 0);
            const w = el.getComputedTextLength();
            el.remove();
            return w;
        })();
        const inset = Math.max(0, (nameWidth - bar) / 2);
        const labelX = inset + 2 * bar + barGap + 16;
        const panelWidth = labelX + labelWidth;
        const columns = width >= panels.length * panelWidth + (panels.length - 1) * panelGap ? panels.length : 1;
        // Above the bars: the panel name and the totals; under them: the bar names
        const panelHeight = 2 * line + bars + line;
        const rowsCount = Math.ceil(panels.length / columns);
        const height = rowsCount * panelHeight + (rowsCount - 1) * 2 * line;
        for (const [name, value] of Object.entries({
            width, height, viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": figure.dataset.label ?? "",
        })) svgEl.setAttribute(name, value);

        const hatch = svg("pattern", { id: `${figure.id}-hatch`, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, svg("defs", {}, svgEl));
        svg("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: ink, "stroke-width": 2 }, hatch);
        const fills = ["none", `url(#${figure.id}-hatch)`, ink];

        panels.forEach((panel, p) => {
            const left = (p % columns) * (panelWidth + panelGap);
            const top = Math.floor(p / columns) * (panelHeight + 2 * line);
            const base = top + 2 * line + bars;
            const max = Math.max(...panel.bars.map((parts) => parts.reduce((sum, v) => sum + v, 0))) || 1;
            const scale = bars / max;
            text(panel.name, left, top + 0.8 * size).setAttribute("font-weight", "bold");

            const middles = [];
            panel.bars.forEach((parts, b) => {
                const x = left + inset + b * (bar + barGap);
                let y = base;
                parts.forEach((value, g) => {
                    const h = value * scale;
                    svg("rect", { x: x + 0.5, y: y - h + 0.5, width: bar - 1, height: Math.max(h - 1, 0), stroke: ink, fill: fills[g] }, svgEl);
                    if (b === 1) middles.push(y - h / 2);
                    y -= h;
                });
                const total = parts.reduce((sum, v) => sum + v, 0);
                text(panel.format(total), x + bar / 2, y - 0.5 * size, "middle");
                text(barNames[b], x + bar / 2, base + line, "middle");
            });

            // Part labels right of the second bar, at the middle of their part,
            // pushed apart to a line each and kept under the totals; a short
            // line leads from the part to its label
            const ys = [...middles];
            for (let g = 1; g < ys.length; g++) ys[g] = Math.min(ys[g], ys[g - 1] - line);
            const highest = top + 2 * line + 0.35 * size;
            for (let g = ys.length - 1; g >= 0; g--) {
                ys[g] = g === ys.length - 1 ? Math.max(ys[g], highest) : Math.max(ys[g], ys[g + 1] + line);
            }
            const labels = labelsOf(panel);
            ys.forEach((ly, g) => {
                svg("line", { x1: left + inset + 2 * bar + barGap + 2, y1: middles[g], x2: left + labelX - 4, y2: ly, stroke: ink, "stroke-width": 1 }, svgEl);
                text(labels[g], left + labelX, ly + 0.35 * size);
            });
        });
    }

    new ResizeObserver(draw).observe(plot);

    return {
        // panels: [{ name, format, bars: [[parts at baseline], [parts with levers]] }]
        update(newPanels) {
            panels = newPanels;
            draw();
        },
    };
}
