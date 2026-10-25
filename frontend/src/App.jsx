
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Cloud,
  Database,
  RefreshCw,
  TrendingDown,
  Wind,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const INITIAL_DATE = "2026-01-15";

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }

  return Number(value).toLocaleString("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatTimestamp(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  });
}

function getHour(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  });
}

function downloadCsv(records, deliveryDate) {
  if (!records?.length) return;

  const columns = [
    "delivery_time",
    "forecast_publish_time",
    "actual_mw",
    "forecast_mw",
    "error_mw",
    "absolute_error_mw",
  ];

  const escapeCsv = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  };

  const rows = records.map((record) => [
    record.startTime,
    record.publishTime,
    record.actual_mw,
    record.forecast_mw,
    record.error_mw,
    record.absolute_error_mw,
  ]);

  const csv = [
    columns.join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `wind-forecast-analysis-${deliveryDate}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function MetricCard({ icon: Icon, label, value, unit, description }) {
  return (
    <article className="metric-card">
      <div className="metric-card-top">
        <span className="metric-icon">
          <Icon size={19} />
        </span>
        <span className="metric-unit">{unit}</span>
      </div>

      <p className="metric-label">{label}</p>
      <h2 className="metric-value">{value}</h2>
      <p className="metric-description">{description}</p>
    </article>
  );
}

export default function App() {
  const [deliveryDate, setDeliveryDate] = useState(INITIAL_DATE);
  const [cutoffHour, setCutoffHour] = useState("10");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  async function loadAnalysis() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        delivery_date: deliveryDate,
        cutoff_hour: cutoffHour,
      });

      const response = await fetch(
        `${API_BASE_URL}/api/analysis?${params.toString()}`
      );

      if (!response.ok) {
        let detail = `Request failed with status ${response.status}`;

        try {
          const body = await response.json();
          if (body.detail) {
            detail =
              typeof body.detail === "string"
                ? body.detail
                : JSON.stringify(body.detail);
          }
        } catch {
          // Keep the original HTTP error message.
        }

        throw new Error(detail);
      }

      const result = await response.json();

      setAnalysis(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        `${err.message || "Unable to load analysis"}. Check that the FastAPI backend is running at ${API_BASE_URL}.`
      );
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalysis();
    // Reload when the selected delivery date or cutoff changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryDate, cutoffHour]);

  const records = analysis?.records || [];
  const metrics = analysis?.metrics || {};

  const chartData = useMemo(() => {
    return records.map((record) => ({
      time: getHour(record.startTime),
      actual: Number(record.actual_mw),
      forecast: Number(record.forecast_mw),
      error: Number(record.error_mw),
    }));
  }, [records]);

  const averageActual = useMemo(() => {
    if (!records.length) return null;

    return (
      records.reduce((sum, record) => sum + Number(record.actual_mw || 0), 0) /
      records.length
    );
  }, [records]);

  const averageForecast = useMemo(() => {
    if (!records.length) return null;

    return (
      records.reduce(
        (sum, record) => sum + Number(record.forecast_mw || 0),
        0
      ) / records.length
    );
  }, [records]);

  const accuracyScore = useMemo(() => {
    if (averageActual === null || averageActual === 0 || metrics.mae_mw == null) {
      return null;
    }

    return Math.max(0, 100 * (1 - Number(metrics.mae_mw) / averageActual));
  }, [averageActual, metrics.mae_mw]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Wind size={25} strokeWidth={2.2} />
          </div>
          <div>
            <h1>WindWise</h1>
            <p>Forecast intelligence</p>
          </div>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <div className="nav-item active">
            <BarChart3 size={19} />
            <span>Overview</span>
          </div>

          <div className="nav-item">
            <Activity size={19} />
            <span>Forecast analysis</span>
          </div>

          <div className="nav-item">
            <Database size={19} />
            <span>Data sources</span>
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="source-status">
            <span className="status-dot" />
            <div>
              <strong>Elexon BMRS</strong>
              <p>Power system data</p>
            </div>
          </div>

          <p className="sidebar-footnote">
            Wind generation forecasting
            <br />
            Analytics workspace · v1.0
          </p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>Overview</strong>
          </div>

          <div className="topbar-right">
            <span className="live-indicator">
              <span className="status-dot" />
              Historical analysis
            </span>

            <div className="avatar" title="Wind analytics">
              WA
            </div>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <Wind size={15} />
                RENEWABLE ENERGY INTELLIGENCE
              </div>

              <h1>Wind Forecast Analytics</h1>

              <p className="page-description">
                Compare wind generation forecasts against actual output to
                understand forecast accuracy at a historical decision point.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={loadAnalysis}
              disabled={loading}
              type="button"
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              Refresh data
            </button>
          </section>

          <section className="filter-panel">
            <div className="filter-heading">
              <div className="filter-heading-icon">
                <CalendarDays size={18} />
              </div>

              <div>
                <h2>Analysis parameters</h2>
                <p>Choose the delivery date and forecast decision cutoff.</p>
              </div>
            </div>

            <div className="filter-controls">
              <label className="filter-field">
                <span>Delivery date</span>
                <input
                  type="date"
                  min="2026-01-01"
                  max="2026-01-31"
                  value={deliveryDate}
                  onChange={(event) => setDeliveryDate(event.target.value)}
                />
              </label>

              <label className="filter-field">
                <span>Decision cutoff (UK time)</span>
                <select
                  value={cutoffHour}
                  onChange={(event) => setCutoffHour(event.target.value)}
                >
                  <option value="8">08:00 — Previous day</option>
                  <option value="9">09:00 — Previous day</option>
                  <option value="10">10:00 — Previous day</option>
                  <option value="11">11:00 — Previous day</option>
                  <option value="12">12:00 — Previous day</option>
                  <option value="16">16:00 — Previous day</option>
                  <option value="18">18:00 — Previous day</option>
                  <option value="20">20:00 — Previous day</option>
                  <option value="23">23:00 — Previous day</option>
                </select>
              </label>

              <div className="filter-time-note">
                <Clock3 size={16} />
                <span>
                  Forecasts published after the cutoff are excluded.
                </span>
              </div>
            </div>
          </section>

          {error && (
            <section className="error-panel" role="alert">
              <AlertCircle size={21} />
              <div>
                <h3>Unable to load analysis</h3>
                <p>{error}</p>
                <button
                  type="button"
                  className="text-button"
                  onClick={loadAnalysis}
                >
                  Try again
                </button>
              </div>
            </section>
          )}

          {loading && !analysis && (
            <section className="loading-panel">
              <span className="loading-spinner" />
              <h3>Loading wind generation data</h3>
              <p>Fetching actuals and eligible forecast versions from Elexon.</p>
            </section>
          )}

          {analysis && (
            <>
              <section className="analysis-status">
                <div className="status-message">
                  <CheckCircle2 size={18} />
                  <span>
                    Analysis loaded for{" "}
                    <strong>
                      {new Date(`${deliveryDate}T12:00:00`).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </strong>
                  </span>
                </div>

                <div className="status-meta">
                  {lastUpdated
                    ? `Updated ${lastUpdated.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : ""}
                </div>
              </section>

              <section className="metrics-grid">
                <MetricCard
                  icon={Activity}
                  label="Mean absolute error"
                  value={formatNumber(metrics.mae_mw, 1)}
                  unit="MW"
                  description="Average absolute forecast error"
                />

                <MetricCard
                  icon={BarChart3}
                  label="Root mean square error"
                  value={formatNumber(metrics.rmse_mw, 1)}
                  unit="MW"
                  description="Penalises larger errors more heavily"
                />

                <MetricCard
                  icon={TrendingDown}
                  label="Forecast bias"
                  value={
                    metrics.bias_mw == null
                      ? "—"
                      : `${Number(metrics.bias_mw) > 0 ? "+" : ""}${formatNumber(
                          metrics.bias_mw,
                          1
                        )}`
                  }
                  unit="MW"
                  description={
                    Number(metrics.bias_mw) > 0
                      ? "Forecasts overestimated actual output"
                      : Number(metrics.bias_mw) < 0
                        ? "Forecasts underestimated actual output"
                        : "Average signed forecast error"
                  }
                />

                <MetricCard
                  icon={CheckCircle2}
                  label="Intervals matched"
                  value={formatNumber(metrics.sample_count)}
                  unit="hours"
                  description={
                    accuracyScore === null
                      ? "Matched hourly forecast and actual values"
                      : `Indicative score: ${formatNumber(accuracyScore, 1)}%`
                  }
                />
              </section>

              <section className="chart-panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">GENERATION PROFILE</div>
                    <h2>Forecast vs actual generation</h2>
                    <p>
                      Hourly wind generation in MW across the selected delivery
                      date.
                    </p>
                  </div>

                  <div className="chart-legend-note">
                    <span className="legend-dot actual-dot" />
                    Actual
                    <span className="legend-dot forecast-dot" />
                    Forecast
                  </div>
                </div>

                {chartData.length > 0 ? (
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{
                          top: 12,
                          right: 18,
                          left: 8,
                          bottom: 4,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e8edf2"
                        />

                        <XAxis
                          dataKey="time"
                          tick={{ fill: "#718096", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          interval={2}
                          tickMargin={10}
                        />

                        <YAxis
                          tick={{ fill: "#718096", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) =>
                            `${(value / 1000).toFixed(0)}k`
                          }
                          width={45}
                        />

                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid #e5eaf0",
                            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                          }}
                          formatter={(value, name) => [
                            `${formatNumber(value, 1)} MW`,
                            name === "actual" ? "Actual generation" : "Forecast",
                          ]}
                          labelFormatter={(label) => `Delivery time: ${label}`}
                        />

                        <Legend
                          formatter={(value) =>
                            value === "actual"
                              ? "Actual generation"
                              : "Forecast generation"
                          }
                          wrapperStyle={{
                            fontSize: 12,
                            paddingTop: 14,
                          }}
                        />

                        <Line
                          type="monotone"
                          dataKey="actual"
                          name="actual"
                          stroke="#149875"
                          strokeWidth={2.8}
                          dot={false}
                          activeDot={{ r: 5, strokeWidth: 0 }}
                        />

                        <Line
                          type="monotone"
                          dataKey="forecast"
                          name="forecast"
                          stroke="#6385e8"
                          strokeWidth={2.5}
                          strokeDasharray="5 4"
                          dot={false}
                          activeDot={{ r: 5, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="empty-state">
                    <BarChart3 size={28} />
                    <p>No matched intervals are available for this selection.</p>
                  </div>
                )}

                <div className="chart-summary">
                  <div>
                    <span className="summary-label">Mean actual generation</span>
                    <strong>
                      {formatNumber(averageActual, 1)}{" "}
                      <small>MW</small>
                    </strong>
                  </div>

                  <div>
                    <span className="summary-label">Mean forecast generation</span>
                    <strong>
                      {formatNumber(averageForecast, 1)}{" "}
                      <small>MW</small>
                    </strong>
                  </div>

                  <div>
                    <span className="summary-label">Matched intervals</span>
                    <strong>
                      {formatNumber(metrics.sample_count)}{" "}
                      <small>hours</small>
                    </strong>
                  </div>
                </div>
              </section>

              <section className="table-panel">
                <div className="panel-heading table-heading">
                  <div>
                    <div className="section-kicker">INTERVAL DETAILS</div>
                    <h2>Hourly forecast comparison</h2>
                    <p>
                      Positive error means the forecast was higher than actual
                      generation; negative error means it was lower.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="secondary-button export-button"
                    onClick={() => downloadCsv(records, deliveryDate)}
                    disabled={!records.length}
                  >
                    <ArrowDownToLine size={16} />
                    Export CSV
                  </button>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Delivery time (UK)</th>
                        <th>Forecast published</th>
                        <th>Actual (MW)</th>
                        <th>Forecast (MW)</th>
                        <th>Error (MW)</th>
                        <th>Absolute error (MW)</th>
                      </tr>
                    </thead>

                    <tbody>
                      {records.map((record, index) => {
                        const errorValue = Number(record.error_mw);

                        return (
                          <tr
                            key={`${record.startTime}-${index}`}
                          >
                            <td className="delivery-cell">
                              {formatTimestamp(record.startTime)}
                            </td>
                            <td>{formatTimestamp(record.publishTime)}</td>
                            <td>{formatNumber(record.actual_mw, 1)}</td>
                            <td>{formatNumber(record.forecast_mw, 1)}</td>
                            <td>
                              <span
                                className={`error-value ${
                                  errorValue > 0
                                    ? "error-positive"
                                    : errorValue < 0
                                      ? "error-negative"
                                      : ""
                                }`}
                              >
                                {errorValue > 0 ? "+" : ""}
                                {formatNumber(errorValue, 1)}
                              </span>
                            </td>
                            <td>
                              {formatNumber(record.absolute_error_mw, 1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {!records.length && (
                    <div className="empty-state table-empty">
                      No records are available for this selection.
                    </div>
                  )}
                </div>

                <div className="table-footer">
                  <span>
                    Showing {records.length} matched hourly intervals
                  </span>
                  <span>Generation values are in MW</span>
                </div>
              </section>

              <section className="methodology-panel">
                <div className="methodology-icon">
                  <Cloud size={21} />
                </div>

                <div>
                  <h3>How this analysis works</h3>
                  <p>
                    Actual wind generation is sourced from Elexon FUELHH.
                    Forecasts are sourced from WINDFOR. Half-hourly actuals are
                    averaged into hourly values to match the hourly forecast
                    resolution. For each delivery hour, the latest forecast
                    published at or before the selected cutoff is compared
                    with actual generation.
                  </p>

                  <p className="assumption-note">
                    <strong>Cutoff assumption:</strong> The previous-day cutoff
                    is a configurable analytical assumption, not a confirmed
                    operational deadline.
                  </p>
                </div>
              </section>
            </>
          )}

          <footer className="page-footer">
            <div>
              <Wind size={16} />
              <span>WindWise Analytics</span>
            </div>

            <span>
              Data source: Elexon BMRS · January 2026 · UK time
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
