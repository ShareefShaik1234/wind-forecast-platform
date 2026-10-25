
import httpx

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"


async def _get_records(
    dataset: str,
    params: dict[str, str],
) -> list[dict]:
    url = f"{BASE_URL}/{dataset}/stream"

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        records = response.json()

    if not isinstance(records, list):
        raise ValueError(
            f"Unexpected {dataset} response: expected a JSON list"
        )

    return records


async def fetch_wind_actuals(
    start: str,
    end: str,
) -> list[dict]:
    """Fetch actual generation for the requested settlement dates."""
    records = await _get_records(
        "FUELHH",
        {
            "settlementDateFrom": start[:10],
            "settlementDateTo": end[:10],
        },
    )

    return [
        r for r in records
        if str(r.get("fuelType", "")).upper() == "WIND"
    ]


async def fetch_wind_forecasts(
    start: str,
    end: str,
) -> list[dict]:
    """
    Fetch forecast versions by publication time.

    The caller must include publication dates before the delivery
    period, so forecasts available at the decision cutoff are retained.
    """
    return await _get_records(
        "WINDFOR",
        {
            "publishDateTimeFrom": start,
            "publishDateTimeTo": end,
        },
    )
