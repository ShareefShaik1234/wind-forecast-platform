# WindWise — Wind Forecast Analytics Platform

WindWise is a full-stack wind forecast analytics platform that compares forecast wind generation with actual generation for historical delivery dates. It helps users understand forecast accuracy, identify forecasting errors, and evaluate forecast performance using key metrics and visualizations.

## Live Demo

- **Frontend:** https://wind-forecast-platform.vercel.app/
- **Backend API:** https://windwise-api-6tca.onrender.com
- **API Documentation:** https://windwise-api-6tca.onrender.com/docs

## Features

- Select a historical delivery date and decision cutoff time.
- Retrieve actual wind generation and forecast data from Elexon BMRS.
- Compare forecasts available before the selected decision cutoff with actual generation.
- Visualize actual and forecast wind generation using line charts.
- View matched time intervals and forecast-versus-actual records.
- Calculate Mean Absolute Error (MAE), Root Mean Squared Error (RMSE), and forecast bias.
- Display the decision cutoff and disclose that the cutoff is an assumption.

## Technology Stack

**Frontend**
- React
- Vite
- Recharts
- CSS

**Backend**
- Python
- FastAPI
- Uvicorn

**Deployment and Tools**
- Vercel — frontend hosting
- Render — backend hosting
- Git and GitHub — version control

**Data Source**
- Elexon BMRS — British electricity market data, including wind generation actuals and forecasts.

## System Architecture

1. The user selects a delivery date and decision cutoff in the React dashboard.
2. The frontend sends a request to the FastAPI backend.
3. The backend retrieves the relevant actual generation and forecast data from Elexon BMRS.
4. Forecast versions published after the decision cutoff are excluded from the comparison.
5. The backend matches forecast and actual records by delivery interval and calculates error metrics.
6. The frontend displays the results in metric cards, a line chart, and a comparison table.

## Forecast Evaluation Metrics

- **MAE (Mean Absolute Error):** Average absolute difference between forecast and actual generation. Lower is better.
- **RMSE (Root Mean Squared Error):** Measures forecast error while penalizing larger errors more heavily. Lower is better.
- **Bias:** Average signed forecast error. A positive bias indicates overforecasting when calculated as forecast minus actual; a negative bias indicates underforecasting.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Checks backend health |
| GET | `/api/analysis?delivery_date=2026-01-15&cutoff_hour=10` | Retrieves forecast analysis for a delivery date and cutoff |
| GET | `/docs` | Interactive FastAPI documentation |

## Run Locally

### Prerequisites

- Python 3.11 or later
- Node.js and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/ShareefShaik1234/wind-forecast-platform.git
cd wind-forecast-platform
```

### 2. Start the backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

**Windows PowerShell:**

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the dependencies and start the API:

```bash
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The backend will run at `http://127.0.0.1:8000`.

### 3. Start the frontend

Open a second terminal from the project root:

```bash
cd frontend
npm install
```

Create a `.env` file inside the `frontend` directory with:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Methodology and Assumptions

The analysis uses a configurable decision cutoff to simulate the information available when a forecast-based decision is made. The default cutoff is an assumption and is not represented as an officially mandated trading or operational deadline.

For each delivery interval, the analysis selects an eligible forecast published no later than the decision cutoff and compares it with the corresponding actual generation. Forecast accuracy is then evaluated using MAE, RMSE, and bias.

The analysis covers historical January 2026 delivery data. Results depend on the availability and structure of the source data.

## Limitations

- The decision cutoff is an explicit modeling assumption.
- Forecast accuracy depends on the quality and availability of source records.
- The analysis evaluates historical data and does not guarantee future forecasting performance.
- The dashboard is intended for analytical and educational purposes, not as a guarantee of electricity-market outcomes.

## Future Improvements

- Add more historical date ranges and configurable cutoff times.
- Compare forecast performance across different periods.
- Add more error metrics and downloadable reports.
- Improve handling of missing or unmatched delivery intervals.

## Author

**Shaik Baba Shareef**

GitHub: https://github.com/ShareefShaik1234
