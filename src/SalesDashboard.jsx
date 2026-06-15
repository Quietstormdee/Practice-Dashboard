import React, { useRef, useEffect, useState, useMemo } from "react";
import * as d3 from "d3";

// ---------------------------------------------------------------------------
// Sample dataset: monthly sales by region for a fictional company
// ---------------------------------------------------------------------------
const REGIONS = ["North", "South", "East", "West"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function generateData() {
  const seedByRegion = { North: 120, South: 90, East: 75, West: 60 };
  const data = [];
  MONTHS.forEach((month, i) => {
    REGIONS.forEach((region) => {
      const base = seedByRegion[region];
      const seasonal = Math.sin((i / 12) * Math.PI * 2) * 15;
      const trend = i * (region === "West" ? 4 : 1.5);
      const noise = (Math.sin(i * 7 + region.length) ) * 8;
      const value = Math.max(10, Math.round(base + seasonal + trend + noise));
      data.push({ month, region, value });
    });
  });
  return data;
}

const RAW_DATA = generateData();

const COLORS = {
  North: "#378ADD",
  South: "#1D9E75",
  East: "#D85A30",
  West: "#7F77DD",
};

// ---------------------------------------------------------------------------
// Bar chart: total sales per region (click a bar to filter the line chart)
// ---------------------------------------------------------------------------
function BarChart({ data, selectedRegion, onSelectRegion, width = 320, height = 260 }) {
  const ref = useRef(null);

  useEffect(() => {
    const margin = { top: 20, right: 16, bottom: 36, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const totals = REGIONS.map((region) => ({
      region,
      total: d3.sum(data.filter((d) => d.region === region), (d) => d.value),
    }));

    const x = d3.scaleBand().domain(REGIONS).range([0, innerW]).padding(0.3);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(totals, (d) => d.total)])
      .nice()
      .range([innerH, 0]);

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Gridlines
    g.append("g")
      .attr("class", "grid")
      .selectAll("line")
      .data(y.ticks(5))
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.08);

    // Bars
    g.append("g")
      .selectAll("rect")
      .data(totals)
      .join("rect")
      .attr("x", (d) => x(d.region))
      .attr("y", (d) => y(d.total))
      .attr("width", x.bandwidth())
      .attr("height", (d) => innerH - y(d.total))
      .attr("rx", 4)
      .attr("fill", (d) => COLORS[d.region])
      .attr("opacity", (d) =>
        selectedRegion && selectedRegion !== d.region ? 0.3 : 1
      )
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        onSelectRegion(selectedRegion === d.region ? null : d.region);
      })
      .append("title")
      .text((d) => `${d.region}: ${d.total.toLocaleString()}`);

    // Value labels
    g.append("g")
      .selectAll("text")
      .data(totals)
      .join("text")
      .attr("x", (d) => x(d.region) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.total) - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 500)
      .attr("fill", "currentColor")
      .text((d) => d.total.toLocaleString());

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call((g2) => g2.select(".domain").attr("stroke-opacity", 0.2))
      .selectAll("text")
      .attr("font-size", 12)
      .attr("fill", "currentColor");

    // Y axis
    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickSize(0).tickFormat(d3.format("~s")))
      .call((g2) => g2.select(".domain").remove())
      .selectAll("text")
      .attr("font-size", 11)
      .attr("fill", "currentColor")
      .attr("opacity", 0.7);
  }, [data, selectedRegion, width, height, onSelectRegion]);

  return <svg ref={ref} role="img" aria-label="Bar chart of total annual sales by region" />;
}

// ---------------------------------------------------------------------------
// Line chart: monthly trend, optionally filtered to one region
// ---------------------------------------------------------------------------
function LineChart({ data, selectedRegion, width = 640, height = 300 }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);

  const regionsToShow = selectedRegion ? [selectedRegion] : REGIONS;

  useEffect(() => {
    const margin = { top: 20, right: 24, bottom: 36, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const x = d3.scalePoint().domain(MONTHS).range([0, innerW]);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.value)])
      .nice()
      .range([innerH, 0]);

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Gridlines
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

    const line = d3
      .line()
      .x((d) => x(d.month))
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    regionsToShow.forEach((region) => {
      const series = data.filter((d) => d.region === region);

      g.append("path")
        .datum(series)
        .attr("fill", "none")
        .attr("stroke", COLORS[region])
        .attr("stroke-width", 2.5)
        .attr("d", line);

      g.append("g")
        .selectAll("circle")
        .data(series)
        .join("circle")
        .attr("cx", (d) => x(d.month))
        .attr("cy", (d) => y(d.value))
        .attr("r", 3.5)
        .attr("fill", COLORS[region])
        .style("cursor", "pointer")
        .on("mouseenter", (_e, d) => setHover({ ...d, region }))
        .on("mouseleave", () => setHover(null));
    });

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call((g2) => g2.select(".domain").attr("stroke-opacity", 0.2))
      .selectAll("text")
      .attr("font-size", 11)
      .attr("fill", "currentColor")
      .attr("opacity", 0.7);

    // Y axis
    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickSize(0).tickFormat(d3.format("~s")))
      .call((g2) => g2.select(".domain").remove())
      .selectAll("text")
      .attr("font-size", 11)
      .attr("fill", "currentColor")
      .attr("opacity", 0.7);
  }, [data, selectedRegion, regionsToShow, width, height]);

  return (
    <div style={{ position: "relative" }}>
      <svg ref={ref} role="img" aria-label="Line chart of monthly sales trends by region" />
      {hover && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "var(--color-background-secondary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-md)",
            padding: "6px 10px",
            fontSize: 12,
            pointerEvents: "none",
          }}
        >
          <strong>{hover.region}</strong> · {hover.month}: {hover.value.toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut chart: share of total sales by region
// ---------------------------------------------------------------------------
function DonutChart({ data, selectedRegion, onSelectRegion, width = 260, height = 260 }) {
  const ref = useRef(null);

  useEffect(() => {
    const radius = Math.min(width, height) / 2;
    const totals = REGIONS.map((region) => ({
      region,
      total: d3.sum(data.filter((d) => d.region === region), (d) => d.value),
    }));

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
      .attr("fill", (d) => COLORS[d.data.region])
      .attr("opacity", (d) =>
        selectedRegion && selectedRegion !== d.data.region ? 0.3 : 1
      )
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        onSelectRegion(selectedRegion === d.data.region ? null : d.data.region);
      })
      .on("mouseenter", function (_e, d) {
        d3.select(this).transition().duration(120).attr("d", arcHover);
      })
      .on("mouseleave", function (_e, d) {
        d3.select(this).transition().duration(120).attr("d", arc);
      })
      .append("title")
      .text(
        (d) =>
          `${d.data.region}: ${d.data.total.toLocaleString()} (${(
            (d.data.total / total) *
            100
          ).toFixed(1)}%)`
      );

    // Center label
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("font-size", 13)
      .attr("fill", "currentColor")
      .attr("opacity", 0.6)
      .text("Total");

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.1em")
      .attr("font-size", 20)
      .attr("font-weight", 500)
      .attr("fill", "currentColor")
      .text(d3.format("~s")(total));
  }, [data, selectedRegion, width, height, onSelectRegion]);

  return <svg ref={ref} role="img" aria-label="Donut chart of sales share by region" />;
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------
export default function SalesDashboard() {
  const [selectedRegion, setSelectedRegion] = useState(null);

  const filteredData = useMemo(() => RAW_DATA, []);

  const grandTotal = useMemo(
    () => d3.sum(RAW_DATA, (d) => d.value),
    []
  );

  const avgMonthly = useMemo(
    () => Math.round(grandTotal / MONTHS.length),
    [grandTotal]
  );

  const bestRegion = useMemo(() => {
    const totals = REGIONS.map((region) => ({
      region,
      total: d3.sum(RAW_DATA.filter((d) => d.region === region), (d) => d.value),
    }));
    return totals.sort((a, b) => b.total - a.total)[0];
  }, []);

  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--color-text-primary)" }}>
      <h2 style={{ marginBottom: "0.25rem" }}>Sales dashboard</h2>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: "1.5rem" }}>
        Monthly sales by region. Click a region in the bar chart or donut to filter the trend line.
      </p>

      {/* Metric cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "1rem" }}>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Total sales</p>
          <p style={{ fontSize: 24, fontWeight: 500, margin: "4px 0 0" }}>{grandTotal.toLocaleString()}</p>
        </div>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "1rem" }}>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Avg per month</p>
          <p style={{ fontSize: 24, fontWeight: 500, margin: "4px 0 0" }}>{avgMonthly.toLocaleString()}</p>
        </div>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "1rem" }}>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Top region</p>
          <p style={{ fontSize: 24, fontWeight: 500, margin: "4px 0 0" }}>{bestRegion.region}</p>
        </div>
      </div>

      {/* Trend line */}
      <div
        style={{
          background: "var(--color-background-primary)",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: "var(--border-radius-lg)",
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>
            {selectedRegion ? `${selectedRegion} region trend` : "All regions trend"}
          </h3>
          {selectedRegion && (
            <button onClick={() => setSelectedRegion(null)} style={{ fontSize: 12 }}>
              Clear filter
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>
          {REGIONS.map((region) => (
            <span key={region} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[region] }} />
              {region}
            </span>
          ))}
        </div>
        <LineChart data={filteredData} selectedRegion={selectedRegion} />
      </div>

      {/* Bar + Donut */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 12,
        }}
      >
        <div
          style={{
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-lg)",
            padding: "1rem 1.25rem",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Annual total by region</h3>
          <BarChart data={filteredData} selectedRegion={selectedRegion} onSelectRegion={setSelectedRegion} />
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
          <h3 style={{ marginTop: 0, alignSelf: "flex-start" }}>Sales share</h3>
          <DonutChart data={filteredData} selectedRegion={selectedRegion} onSelectRegion={setSelectedRegion} />
        </div>
      </div>
    </div>
  );
}
