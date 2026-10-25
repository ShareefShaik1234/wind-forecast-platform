
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.analytics import compare_forecasts, calculate_metrics
from app.elexon import fetch_wind_actuals, fetch_wind_forecasts


UK_TZ = ZoneInfo("Europe/London")
UTC = ZoneInfo("UTC")


app = FastAPI(title="Wind Forecast Analytics API")


# Allow the local React/Vite frontend to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/diagnostics/elexon")
async def elexon_diagnostics():
    try:
        actuals = await fetch_wind_actuals(
            "2026-01-15T00:00:00Z",
            "2026-01-15T23:59:59Z",
        )

        forecasts = await fetch_wind_forecasts(
            "2026-01-14T00:00:00Z",
            "2026-01-15T23:59:59Z",
        )

        forecast_df = pd.DataFrame(forecasts)

        if not forecast_df.empty:
            forecast_df["startTime"] = pd.to_datetime(
                forecast_df["startTime"],
                utc=True,
            )

            target_forecasts = forecast_df[
                forecast_df["startTime"].dt.strftime("%Y-%m-%d")
                == "2026-01-15"
            ]

            delivery_times = sorted(
                target_forecasts["startTime"]
                .drop_duplicates()
                .dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                .tolist()
            )
        else:
            target_forecasts = forecast_df
            delivery_times = []

        comparison = compare_forecasts(
            actuals,
            forecasts,
            cutoff_hour=10,
        )

        return {
            "delivery_date": "2026-01-15",
            "cutoff_hour_uk": 10,
            "cutoff_is_assumption": True,
            "actual_records": len(actuals),
            "forecast_versions_fetched": len(forecasts),
            "forecast_delivery_intervals": len(delivery_times),
            "forecast_delivery_timestamps": delivery_times,
            "matched_intervals": len(comparison),
            "metrics": calculate_metrics(comparison),
            "matched_sample": (
                comparison.head(5)
                .assign(
                    startTime=lambda df: df["startTime"].astype(str),
                    publishTime=lambda df: df["publishTime"].astype(str),
                )
                .to_dict(orient="records")
            ),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Elexon data request failed: {exc}",
        ) from exc


@app.get("/api/analysis")
async def analyze_delivery_day(
    delivery_date: date = Query(...),
    cutoff_hour: int = Query(default=10, ge=0, le=23),
):
    try:
        # This pilot supports January 2026 only.
        if delivery_date.year != 2026 or delivery_date.month != 1:
            raise HTTPException(
                status_code=400,
                detail="This pilot supports January 2026 only.",
            )

        previous_day = delivery_date - timedelta(days=1)

        cutoff_local = datetime.combine(
            previous_day,
            time(hour=cutoff_hour),
            tzinfo=UK_TZ,
        )

        cutoff_utc = cutoff_local.astimezone(UTC)

        publication_start = datetime.combine(
            previous_day,
            time.min,
            tzinfo=UK_TZ,
        ).astimezone(UTC)

        actuals = await fetch_wind_actuals(
            f"{delivery_date.isoformat()}T00:00:00Z",
            f"{delivery_date.isoformat()}T23:59:59Z",
        )

        forecasts = await fetch_wind_forecasts(
            publication_start.isoformat(),
            cutoff_utc.isoformat(),
        )

        comparison = compare_forecasts(
            actuals,
            forecasts,
            cutoff_hour=cutoff_hour,
        )

        records = []

        for row in comparison.to_dict(orient="records"):
            records.append(
                {
                    "startTime": row["startTime"].isoformat(),
                    "publishTime": row["publishTime"].isoformat(),
                    "actual_mw": float(row["actual_mw"]),
                    "forecast_mw": float(row["forecast_mw"]),
                    "error_mw": float(row["error_mw"]),
                    "absolute_error_mw": float(
                        row["absolute_error_mw"]
                    ),
                }
            )

        return {
            "delivery_date": delivery_date.isoformat(),
            "timezone": "Europe/London",
            "decision_cutoff": cutoff_local.isoformat(),
            "cutoff_is_assumption": True,
            "actual_records": len(actuals),
            "forecast_versions_fetched": len(forecasts),
            "matched_intervals": len(records),
            "metrics": calculate_metrics(comparison),
            "records": records,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Analysis failed: {exc}",
        ) from exc
