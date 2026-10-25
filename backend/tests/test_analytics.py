
import pandas as pd
import pytest

from app.analytics import (
    calculate_metrics,
    compare_forecasts,
    prepare_actuals,
)


def test_actuals_preserve_half_hour_intervals():
    records = [
        {
            "startTime": "2026-01-15T00:00:00Z",
            "generation": 100,
            "fuelType": "WIND",
        },
        {
            "startTime": "2026-01-15T00:30:00Z",
            "generation": 120,
            "fuelType": "WIND",
        },
    ]

    result = prepare_actuals(records)

    assert len(result) == 2
    assert result["actual_mw"].tolist() == [100, 120]


def test_metrics():
    comparison = pd.DataFrame({"error_mw": [100, -100]})

    result = calculate_metrics(comparison)

    assert result["sample_count"] == 2
    assert result["mae_mw"] == 100
    assert result["rmse_mw"] == 100
    assert result["bias_mw"] == 0


def test_latest_eligible_forecast_is_selected():
    actuals = [
        {
            "startTime": "2026-01-15T00:00:00Z",
            "generation": 100,
            "fuelType": "WIND",
        }
    ]

    forecasts = [
        {
            "startTime": "2026-01-15T00:00:00Z",
            "publishTime": "2026-01-14T08:00:00Z",
            "generation": 130,
        },
        {
            "startTime": "2026-01-15T00:00:00Z",
            "publishTime": "2026-01-14T09:30:00Z",
            "generation": 120,
        },
        {
            "startTime": "2026-01-15T00:00:00Z",
            "publishTime": "2026-01-14T11:00:00Z",
            "generation": 90,
        },
    ]

    result = compare_forecasts(actuals, forecasts, cutoff_hour=10)

    assert len(result) == 1
    assert result.iloc[0]["forecast_mw"] == 120
    assert result.iloc[0]["error_mw"] == 20


def test_invalid_cutoff_is_rejected():
    with pytest.raises(ValueError):
        compare_forecasts([], [], cutoff_hour=24)
