
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

UK_TZ = ZoneInfo("Europe/London")


def prepare_actuals(records: list[dict]) -> pd.DataFrame:
    columns = ["startTime", "actual_mw"]
    df = pd.DataFrame(records)

    if df.empty:
        return pd.DataFrame(columns=columns)

    required = {"startTime", "generation"}
    if not required.issubset(df.columns):
        raise ValueError(
            "Actual records require startTime and generation"
        )

    if "fuelType" in df.columns:
        df = df[
            df["fuelType"].astype(str).str.upper() == "WIND"
        ].copy()

    df["startTime"] = pd.to_datetime(
        df["startTime"], utc=True, errors="coerce"
    )
    df["generation"] = pd.to_numeric(
        df["generation"], errors="coerce"
    )
    df = df.dropna(subset=["startTime", "generation"])

    if (df["generation"] < 0).any():
        raise ValueError("Actual generation cannot be negative")

    if df["startTime"].duplicated().any():
        raise ValueError("Duplicate actual timestamps found")

    # Preserve original half-hourly resolution.
    return (
        df.rename(columns={"generation": "actual_mw"})
        [columns]
        .sort_values("startTime")
        .reset_index(drop=True)
    )


def prepare_forecasts(records: list[dict]) -> pd.DataFrame:
    columns = ["startTime", "publishTime", "forecast_mw"]
    df = pd.DataFrame(records)

    if df.empty:
        return pd.DataFrame(columns=columns)

    required = {"startTime", "publishTime", "generation"}
    if not required.issubset(df.columns):
        raise ValueError(
            "Forecast records require startTime, publishTime, "
            "and generation"
        )

    df["startTime"] = pd.to_datetime(
        df["startTime"], utc=True, errors="coerce"
    )
    df["publishTime"] = pd.to_datetime(
        df["publishTime"], utc=True, errors="coerce"
    )
    df["generation"] = pd.to_numeric(
        df["generation"], errors="coerce"
    )
    df = df.dropna(
        subset=["startTime", "publishTime", "generation"]
    )

    if (df["generation"] < 0).any():
        raise ValueError("Forecast generation cannot be negative")

    return (
        df.rename(columns={"generation": "forecast_mw"})
        [columns]
        .sort_values(["startTime", "publishTime"])
        .reset_index(drop=True)
    )


def compare_forecasts(
    actual_records: list[dict],
    forecast_records: list[dict],
    cutoff_hour: int = 10,
) -> pd.DataFrame:
    if not 0 <= cutoff_hour <= 23:
        raise ValueError("cutoff_hour must be between 0 and 23")

    actuals = prepare_actuals(actual_records)
    forecasts = prepare_forecasts(forecast_records)

    if actuals.empty or forecasts.empty:
        return pd.DataFrame()

    # Decision cutoff is the preceding UK calendar day.
    delivery_local = forecasts["startTime"].dt.tz_convert(UK_TZ)
    cutoff_local = (
        delivery_local.dt.normalize()
        - pd.Timedelta(days=1)
        + pd.Timedelta(hours=cutoff_hour)
    )

    forecasts = forecasts.copy()
    forecasts["decision_cutoff"] = cutoff_local.dt.tz_convert("UTC")

    eligible = forecasts[
        forecasts["publishTime"] <= forecasts["decision_cutoff"]
    ].copy()

    if eligible.empty:
        return pd.DataFrame()

    # One latest eligible version for each half-hour delivery interval.
    selected = (
        eligible.sort_values(["startTime", "publishTime"])
        .drop_duplicates("startTime", keep="last")
    )

    comparison = actuals.merge(
        selected[["startTime", "publishTime", "forecast_mw"]],
        on="startTime",
        how="inner",
        validate="one_to_one",
    )

    if comparison.empty:
        return comparison

    comparison["error_mw"] = (
        comparison["forecast_mw"] - comparison["actual_mw"]
    )
    comparison["absolute_error_mw"] = comparison["error_mw"].abs()

    return comparison.sort_values("startTime").reset_index(drop=True)


def calculate_metrics(comparison: pd.DataFrame) -> dict:
    if comparison.empty:
        return {
            "sample_count": 0,
            "mae_mw": None,
            "rmse_mw": None,
            "bias_mw": None,
        }

    errors = pd.to_numeric(
        comparison["error_mw"], errors="coerce"
    ).dropna().to_numpy(dtype=float)

    if not np.isfinite(errors).all():
        raise ValueError("Errors must contain only finite values")

    if len(errors) == 0:
        return {
            "sample_count": 0,
            "mae_mw": None,
            "rmse_mw": None,
            "bias_mw": None,
        }

    return {
        "sample_count": int(len(errors)),
        "mae_mw": round(float(np.mean(np.abs(errors))), 3),
        "rmse_mw": round(float(np.sqrt(np.mean(errors ** 2))), 3),
        "bias_mw": round(float(np.mean(errors)), 3),
    }
