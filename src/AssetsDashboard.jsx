import React, { useRef, useEffect, useMemo, useState } from "react";
import * as d3 from "d3";

const DIRECTORATE_TOTALS = {
  "PMO-1": 3000,
  "PMO-2": 15000,
  "PMO-3": 8000,
  "PMO-4": 13000,
  "PMO-5": 34000,
  "PMO-6": 2000,
  "PMO-7": 5000,
  "PMO-8": 17000,
};

const ASSET_TYPES = ["Report", "Policy", "Plan", "Metrics", "Training", "Presentation", "IT", "Summaries"];

function seededWeight(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = (h * 31 + seedStr.charCodeAt(i)) % 9973;
  }
  return 0.4 + ((h % 1000) / 1000) * 1.2;
}

const RAW_DATA = [];
Object.entries(DIRECTORATE_TOTALS).forEach(([directorate, total]) => {
  const weights = ASSET_TYPES.map((type) => seededWeight(directorate + type));
  const weightSum = d3.sum(weights);

  let assigned = 0;
  ASSET_TYPES.forEach((type, i) => {
    let assets;
    if (i === ASSET_TYPES.length - 1) {
      assets = total - assigned;
    } else {
      assets = Math.round((weights[i] / weightSum) * total);
      assigned += assets;
    }
    RAW_DATA.push({ directorate, type, assets: Math.max(0, assets) });
  });
});

const DIRECTORATES = Object.keys(DIRECTORATE_TOTALS);

const PALETTE = [
  "#378ADD",
  "#1D9E75",
  "#D85A30",
  "#7F77DD",
  "#D4537E",
  "#BA7517",
  "#639922",
  "#888780",
];

const TYPE_COLORS = {};
ASSET_TYPES.forEach((type, i) => {
  TYPE_COLORS[type] = PALETTE[i % PALETTE.length];
});

function StackedBarChart({ data, selectedDirectorate, onSelectDirectorate, width = 680, height = 360 }) {
  const ref = useRef(null);

  useEffect(() => {
    const margin = { top: 24, right: 16, bottom: 40, left: 64 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const byDirectorate = DIRECTORATES.map((directorate) => {
      const row = { directorate };
      ASSET_TYPES.forEach((type) => {
        const match = data.find((d) => d.directorate === directorate && d.type === type);
        row[type] = match ? match.assets : 0;
      });
      row.total = d3.sum(ASSET_TYPES, (type) => row[type]);
      return row;
    }).sort((a, b) => b.total - a.total);

    const stack = d3.stack().keys(ASSET_TYPES);
    const series = stack(byDirectorate);

    const x = d3
      .scaleBand()
      .domain(byDirectorate.map((d) => d.directorate))
      .range([0, innerW])
      .padding(0.3);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(byDirectorate, (d) => d.total)])
      .nice()
      .range([innerH, 0]);

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .selectAll("line")
      .data(y.ticks(5))
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.08);

    g.selectAll("g.layer")
      .data(series)
      .join("g")
      .attr("class", "layer")
      .attr("fill", (d) => TYPE_COLORS[d.key])
      .each(function (layer) {
        d3.select(this)
          .selectAll("rect")
          .data(layer.map((seg) => ({ ...seg, type: layer.key })))
          .join("rect")
          .attr("x", (d) => x(d.data.directorate))
          .attr("y", (d) => y(d[1]))
          .attr("width", x.bandwidth())
          .attr("height", (d) => y(d[0]) - y(d[1]))
          .attr("opacity", (d) =>
            selectedDirectorate && selectedDirectorate !== d.data.directorate ? 0.3 : 1
          )
          .style("cursor", "pointer")
          .on("click", (_e, d) =>
            onSelectDirectorate(
              selectedDirectorate === d.data.directorate ? null : d.data.directorate
            )
          )
          .append("title")
          .text(
            (d) =>
              `${d.data.directorate} · ${d.type}: ${(d[1] - d[0]).toLocaleString()} assets`
          );
      });

    g.append("g")
      .selectAll("text")
      .data(byDirectorate)
      .join("text")
      .attr("x", (d) => x(d.directorate) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.total) - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 500)
      .attr("fill", "currentColor")
      .attr("opacity", (d) =>
        selectedDirectorate && selectedDirectorate !== d.directorate ? 0.3 : 1
      )
      .text((d) => d.total.toLocaleString());

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call((g2) => g2.select(".domain").attr("stroke-opacity", 0.2))
      .selectAll("text")
      .attr("font-size", 12)
      .attr("fill", "currentColor")
      .style("cursor", "pointer")
      .style("font-weight", (d) => (d === selectedDirectorate ? 700 : 400))
      .on("click", (_e, d) =>
        onSelectDirectorate(selectedDirectorate === d ? null : d)
      );

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickSize(0).tickFormat(d3.format("~s")))
      .call((g2) => g2.select(".domain").remove())
      .selectAll("text")
      .attr("font-size", 11)
      .attr("fill", "currentColor")
      .attr("opacity", 0.7);
  }, [data, selectedDirectorate, onSelectDirectorate, width, height]);

  return <svg ref={ref} role="img" aria-label="Stacked bar chart of data assets by directorate, broken down by asset type. Click a bar to see its breakdown." />;
}

function DonutChart({ data, directorate, width = 220, height = 220 }) {
  const ref = useRef(null);

  useEffect(() => {
    const radius = Math.min(width, height) / 2;

    const filtered = directorate ? data.filter((d) => d.directorate === directorate) : data;

    const totals = ASSET_TYPES.map((type) => ({
      type,
      total: d3.sum(filtered.filter((d) => d.type === type), (d) => d.assets),
    })).filter((d) => d.total > 0);

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    const pie = d3.pie().value((d) => d.total).sort(null).padAngle(0.02);
    const arc = d3.arc().innerRadius(radius * 0.6).outerRadius(radius * 0.95);
    const arcHover = d3.arc().innerRadius(radius * 0.58).outerRadius(radius * 1.0);

    const total = d3.sum(totals, (d) => d.total);

    g.selectAll("path")
      .data(pie(totals))
      .join("path")
      .attr("d", arc)
      .attr("fill", (d) => TYPE_COLORS[d.data.type])
      .on("mouseenter", function () {
        d3.select(this).transition().duration(120).attr("d", arcHover);
      })
      .on("mouseleave", function () {
        d3.select(this).transition().duration(120).attr("d", arc);
      })
      .append("title")
      .text(
        (d) =>
          `${d.data.type}: ${d.data.total.toLocaleString()} (${(
            (d.data.total / total) *
            100
          ).toFixed(1)}%)`
      );

    const labelArc = d3.arc().innerRadius(radius * 0.78).outerRadius(radius * 0.78);
    g.selectAll("text.slice-label")
      .data(pie(totals).filter((d) => d.endAngle - d.startAngle > 0.2))
      .join("text")
      .attr("class", "slice-label")
      .attr("transform", (d) => `translate(${labelArc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", 11)
      .attr("font-weight", 500)
      .attr("fill", "#fff")
      .style("pointer-events", "none")
      .text((d) => d.data.total.toLocaleString());

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("font-size", 13)
      .attr("fill", "currentColor")
      .attr("opacity", 0.6)
      .text(directorate ? directorate : "Total assets");

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.1em")
      .attr("font-size", 20)
      .attr("font-weight", 500)
      .attr("fill", "currentColor")
      .text(d3.format("~s")(total));
  }, [data, directorate, width, height]);

  return <svg ref={ref} role="img" aria-label={directorate ? `Donut chart of asset breakdown for ${directorate}` : "Donut chart of asset share by asset type"} />;
}

export default function AssetsDashboard() {
  const data = RAW_DATA;
  const [selectedDirectorate, setSelectedDirectorate] = useState(null);

  const grandTotal = useMemo(
    () => d3.sum(Object.values(DIRECTORATE_TOTALS)),
    []
  );
  const avgPerDirectorate = useMemo(
    () => Math.round(grandTotal / DIRECTORATES.length),
    [grandTotal]
  );
  const topDirectorate = useMemo(() => {
    const entries = Object.entries(DIRECTORATE_TOTALS);
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }, []);

  const selectedBreakdown = useMemo(() => {
    if (!selectedDirectorate) return [];
    return data
      .filter((d) => d.directorate === selectedDirectorate)
      .filter((d) => d.assets > 0)
      .sort((a, b) => b.assets - a.assets);
  }, [data, selectedDirectorate]);

  const overallBreakdown = useMemo(() => {
    return ASSET_TYPES.map((type) => ({
      type,
      total: d3.sum(data.filter((d) => d.type === type), (d) => d.assets),
    })).sort((a, b) => b.total - a.total);
  }, [data]);

  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--color-text-primary)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: "0.25rem" }}>Directorate data assets</h2>
          <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: "1.5rem" }}>
            Data asset counts by directorate, broken down by asset type. Select a directorate to see its full breakdown.
          </p>
        </div>
        <select
          value={selectedDirectorate || ""}
          onChange={(e) => setSelectedDirectorate(e.target.value || null)}
          style={{ fontSize: 14, padding: "6px 10px" }}
        >
          <option value="">All directorates</option>
          {DIRECTORATES.map((directorate) => (
            <option key={directorate} value={directorate}>
              {directorate}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "1rem" }}>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Total assets</p>
          <p style={{ fontSize: 24, fontWeight: 500, margin: "4px 0 0" }}>{grandTotal.toLocaleString()}</p>
        </div>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "1rem" }}>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Avg per directorate</p>
          <p style={{ fontSize: 24, fontWeight: 500, margin: "4px 0 0" }}>{avgPerDirectorate.toLocaleString()}</p>
        </div>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "1rem" }}>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Top directorate</p>
          <p style={{ fontSize: 24, fontWeight: 500, margin: "4px 0 0" }}>{topDirectorate}</p>
        </div>
      </div>

      <div
        style={{
          background: "var(--color-background-primary)",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: "var(--border-radius-lg)",
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Assets by directorate, by type</h3>
          {selectedDirectorate && (
            <button onClick={() => setSelectedDirectorate(null)} style={{ fontSize: 12 }}>
              Clear selection
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>
          {ASSET_TYPES.map((type) => {
            const typeTotal = d3.sum(data.filter((d) => d.type === type), (d) => d.assets);
            return (
              <span key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: TYPE_COLORS[type] }} />
                {type} ({typeTotal.toLocaleString()})
              </span>
            );
          })}
        </div>
        <StackedBarChart
          data={data}
          selectedDirectorate={selectedDirectorate}
          onSelectDirectorate={setSelectedDirectorate}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div
          style={{
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-lg)",
            padding: "1rem 1.25rem",
          }}
        >
          {selectedDirectorate ? (
            <>
              <h3 style={{ marginTop: 0 }}>{selectedDirectorate} breakdown</h3>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <DonutChart data={data} directorate={selectedDirectorate} />
              </div>
              <table style={{ width: "100%", fontSize: 13, marginTop: 12, borderCollapse: "collapse" }}>
                <tbody>
                  {selectedBreakdown.map((d) => (
                    <tr key={d.type}>
                      <td style={{ padding: "4px 0" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: TYPE_COLORS[d.type] }} />
                          {d.type}
                        </span>
                      </td>
                      <td style={{ padding: "4px 0", textAlign: "right", color: "var(--color-text-secondary)" }}>
                        {d.assets.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 200, color: "var(--color-text-secondary)", fontSize: 14, textAlign: "center" }}>
              Select a directorate to see its asset breakdown
            </div>
          )}
        </div>

        <div
          style={{
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-lg)",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <h3 style={{ marginTop: 0, alignSelf: "flex-start" }}>Overall mix by asset type</h3>
          <DonutChart data={data} />
          <table style={{ width: "100%", fontSize: 13, marginTop: 12, borderCollapse: "collapse" }}>
            <tbody>
              {overallBreakdown.map((d) => (
                <tr key={d.type}>
                  <td style={{ padding: "4px 0" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: TYPE_COLORS[d.type] }} />
                      {d.type}
                    </span>
                  </td>
                  <td style={{ padding: "4px 0", textAlign: "right", color: "var(--color-text-secondary)" }}>
                    {d.total.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
