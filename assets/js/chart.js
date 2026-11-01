// Minimal chart over months: one black line, bare axes without ticks, 1–2 key
// numbers written next to their points, an optional dashed second line (a
// scenario, e.g. with all levers), and a crosshair tooltip (pointer and
// arrow keys). Plain SVG lines; all text
// in the page font at the page size (style.css).
//
// Markup it expects inside the figure:
//   .chart-plot    the SVG and the tooltip go here
const SVG_NS = "http://www.w3.org/2000/svg";
// Plot height at a 16px page font; it grows with the page font
const HEIGHT = 260;
// The y axis is on the text line (x = 1: the middle of its 1px line is on
// the pixel grid); its name is over its top
const MARGIN = { top: 40, right: 24, bottom: 16, left: 1 };

function svg(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    parent.append(el);
    return el;
}

function html(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

// options:
//   key          field of a row to draw
//   yLabel       y axis name, level, over the top of the axis, from the text
//                line (text turned along the axis did not look like the page
//                font; most names are too long for the margin). The x axis has
//                no name: the texts at its ends say what it is (see `ends` in update)
//   yMax         fixed top of the y axis (e.g. 1 for percentages)
//   formatValue, formatX   texts for the tooltip
//   secondKey, secondName   field of a row for the dashed second line, and
//                what it is in the tooltip, e.g. "with all levers"
export function createChart(figure, options) {
    const { key, yMax = null, yLabel, formatValue, formatX, secondKey = null, secondName = "" } = options;
    const plot = figure.querySelector(".chart-plot");

    let rows = [];
    let labels = [];
    let ends = null;
    let svgEl = null;

    const tooltip = html("div", "chart-tooltip");
    tooltip.hidden = true;
    plot.append(tooltip);

    function renderTooltip(i) {
        const row = rows[i];
        const second = secondKey && row[secondKey] !== undefined
            ? [html("div", "", `${formatValue(row[secondKey])} ${secondName}`)]
            : [];
        tooltip.replaceChildren(html("div", "chart-tooltip-title", formatX(row.month)), html("strong", "", formatValue(row[key])), ...second);
    }

    function draw() {
        const width = plot.clientWidth;
        if (!width || rows.length === 0) return;

        const values = rows.map((row) => row[key]);
        const seconds = secondKey && rows[0][secondKey] !== undefined ? rows.map((row) => row[secondKey]) : null;
        const size = parseFloat(getComputedStyle(figure).fontSize) || 16;
        const height = Math.round((HEIGHT * size) / 16);
        const marginLeft = MARGIN.left;
        const innerW = width - marginLeft - MARGIN.right;
        // Room for the x axis ends under the axis
        const marginBottom = MARGIN.bottom + (ends ? 1.25 * size : 0);
        const innerH = height - MARGIN.top - marginBottom;
        const xMin = rows[0].month;
        const xMax = rows[rows.length - 1].month;
        const dataMax = Math.max(...values, ...(seconds ?? [])) || 1;
        if (!Number.isFinite(dataMax)) return;
        const yTop = yMax ?? dataMax * 1.1;
        const x = (month) => marginLeft + (xMax === xMin ? 0 : ((month - xMin) / (xMax - xMin)) * innerW);
        const y = (value) => MARGIN.top + innerH - (value / yTop) * innerH;

        svgEl?.remove();
        svgEl = document.createElementNS(SVG_NS, "svg");
        for (const [name, value] of Object.entries({
            width, height, viewBox: `0 0 ${width} ${height}`,
            role: "img", "aria-label": figure.dataset.label ?? "", tabindex: 0,
        })) svgEl.setAttribute(name, value);
        plot.prepend(svgEl);

        // Colours go into attributes, where var() does not work
        const style = getComputedStyle(figure);
        const ink = style.getPropertyValue("--ink").trim();
        const line = (x1, y1, x2, y2, attrs = {}) => svg("line", { x1, y1, x2, y2, stroke: ink, "stroke-width": 1, ...attrs }, svgEl);
        const dashed = { "stroke-dasharray": "6 4" };
        const text = (content, tx, ty, anchor = "start") => {
            const el = svg("text", { x: tx, y: ty, "text-anchor": anchor, fill: ink }, svgEl);
            el.textContent = content;
            return el;
        };

        // Bare axes
        const bottom = MARGIN.top + innerH;
        line(marginLeft, bottom, width - MARGIN.right + 8, bottom);
        line(marginLeft, bottom, marginLeft, MARGIN.top - 16);
        if (yLabel) text(yLabel, marginLeft, MARGIN.top - 16 - 0.4 * size).setAttribute("font-weight", "bold");
        // Under the x axis: what its first and last points are
        if (ends) {
            text(ends[0], marginLeft, bottom + 1.25 * size);
            text(ends[1], width - MARGIN.right, bottom + 1.25 * size, "end");
        }

        const points = rows.map((row, i) => `${x(row.month)},${y(values[i])}`).join(" ");
        svg("polyline", { points, fill: "none", stroke: ink, "stroke-width": 2, "stroke-linejoin": "round" }, svgEl);
        if (seconds) {
            const secondPoints = rows.map((row, i) => `${x(row.month)},${y(seconds[i])}`).join(" ");
            svg("polyline", { points: secondPoints, fill: "none", stroke: ink, "stroke-width": 2, "stroke-linejoin": "round", ...dashed }, svgEl);
        }

        // Key numbers: a dot and the value next to it
        for (const label of labels) {
            const px = x(rows[label.index].month);
            const py = y((label.second ? seconds : values)[label.index]);
            svg("circle", { cx: px, cy: py, r: 4, fill: ink }, svgEl);
            const end = label.align === "end";
            const tx = px + (end ? -8 : 8);
            const el = text(label.text, tx, py, end ? "end" : "start");
            // Clear of the lines under the whole text, not only at the point:
            // under the lowest or over the highest line point the text spans
            const w = el.getComputedTextLength();
            const [from, to] = end ? [tx - w, tx] : [tx, tx + w];
            const spanned = rows.flatMap((row, i) => {
                const rx = x(row.month);
                return rx >= from && rx <= to ? [y(values[i]), ...(seconds ? [y(seconds[i])] : [])] : [];
            });
            const ty = label.below
                ? Math.max(py, ...spanned) + 6 + 0.8 * size
                : Math.min(py, ...spanned) - 8;
            el.setAttribute("y", ty);
        }

        // Crosshair: snaps to the nearest month
        const cross = svg("g", { visibility: "hidden" }, svgEl);
        const crossLine = svg("line", { y1: MARGIN.top, y2: bottom, class: "chart-cross" }, cross);
        const dot = svg("circle", { r: 4, class: "chart-dot" }, cross);
        const hit = svg("rect", {
            x: marginLeft, y: MARGIN.top, width: innerW, height: innerH, class: "chart-hit",
        }, svgEl);

        let active = null;
        const show = (i) => {
            active = i;
            const cx = x(rows[i].month);
            crossLine.setAttribute("x1", cx);
            crossLine.setAttribute("x2", cx);
            dot.setAttribute("cx", cx);
            dot.setAttribute("cy", y(values[i]));
            cross.setAttribute("visibility", "visible");
            renderTooltip(i);
            tooltip.hidden = false;
            const tipWidth = tooltip.offsetWidth;
            tooltip.style.left = `${cx + 12 + tipWidth > width ? cx - 12 - tipWidth : cx + 12}px`;
            tooltip.style.top = `${MARGIN.top}px`;
        };
        const hide = () => {
            active = null;
            cross.setAttribute("visibility", "hidden");
            tooltip.hidden = true;
        };
        const indexAt = (clientX) => {
            const left = svgEl.getBoundingClientRect().left + marginLeft;
            const i = Math.round(((clientX - left) / innerW) * (rows.length - 1));
            return Math.min(rows.length - 1, Math.max(0, i));
        };

        hit.addEventListener("pointermove", (event) => show(indexAt(event.clientX)));
        hit.addEventListener("pointerdown", (event) => show(indexAt(event.clientX)));
        hit.addEventListener("pointerleave", hide);
        svgEl.addEventListener("focus", () => show(rows.length - 1));
        svgEl.addEventListener("blur", hide);
        svgEl.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const step = event.key === "ArrowRight" ? 1 : -1;
            show(Math.min(rows.length - 1, Math.max(0, (active ?? rows.length - 1) + step)));
        });
        tooltip.hidden = true;
    }

    new ResizeObserver(draw).observe(plot);

    return {
        // labels: [{ index, text, align, below, second }]   numbers at rows[index]; align "end" puts the
        //         text left of the point, below puts it under the point, second puts it on the dashed line
        // ends:   [first, last]   texts under the ends of the x axis, e.g. ["now", "in 12 months"]
        update(newRows, { labels: newLabels = [], ends: newEnds = null } = {}) {
            rows = newRows;
            ends = newEnds;
            labels = newLabels;
            draw();
        },
    };
}
