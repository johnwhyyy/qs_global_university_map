# QS World Best Universities Map

Interactive, static-hostable React visualization of the top 100 QS 2027 universities on a minimalist 3D globe.

## Stack

- React + TypeScript + Vite
- `react-globe.gl`, Three.js, `world-atlas`, and `topojson-client`
- Plain CSS with responsive layout and no required server runtime

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build

```bash
npm run build
npm run preview
```

The production output is written to `dist/`.

## Deploy

### Vercel

1. Import the repository in Vercel.
2. Set the build command to `npm run build`.
3. Set the output directory to `dist`.

### Netlify

1. Import the repository in Netlify.
2. Set the build command to `npm run build`.
3. Set the publish directory to `dist`.

### GitHub Pages

1. Push `main` to GitHub.
2. In the repository, open `Settings` > `Pages`.
3. Under `Build and deployment`, choose `GitHub Actions`.
4. Commit the workflow in `.github/workflows/deploy-pages.yml`.
5. After the action finishes, GitHub Pages will give you a public link like `https://YOUR_USERNAME.github.io/qs_global_university_map/`.

## Data

The structured data lives in `src/data/universities.json`. Each record includes:

- 2027 and 2026 QS rank, university name, city, country
- Region
- Campus latitude and longitude
- Annual tuition amount when available, currency, label, and assumptions
- Official website
- Marker logo path
- QS, logo, official website, and coordinate source links

The ranking and region values are sourced from `2027 QS World University Rankings.xlsx`, using rows 4 through 103. The app currently renders 100 university records.

The app keeps the QS page URL in the row data for reference:

- https://www.topuniversities.com/world-university-rankings

## Tuition Assumptions

Tuition varies by residency, course, school, and whether fees are quoted as tuition only or full cost of attendance. To keep the visualization comparable and readable, each record uses one representative annual figure:

- US universities: undergraduate tuition only, excluding room, board, insurance, fees, books, travel, and personal expenses unless noted.
- UK universities: representative overseas undergraduate tuition because overseas fees vary significantly by course.
- Singapore universities: representative international undergraduate tuition; tuition grant status is noted in the assumption.
- Hong Kong universities: non-local undergraduate tuition.
- China universities: representative international undergraduate tuition.
- ETH Zurich: two semesters of tuition plus the international surcharge; mandatory semester fees are excluded.
- UNSW Sydney: representative international undergraduate indicative annual tuition.

The original top-ranked records keep representative tuition figures. Expanded top-100 records that were not manually audited use a clear "see official website" tuition label rather than an invented amount.

## Logos And Markers

The app uses local image assets in `public/logos/qs/`. Existing QS-sourced images are preserved for the original top-ranked records. For expanded records where QS profile scraping was unavailable from the local environment, generated local placeholder SVGs are stored in the same folder so the deployed app remains self-contained and does not hotlink assets.

Logo source metadata, local paths, dimensions, and notes are recorded in `src/data/qs-logo-sources.json`. Confirm permission to use each university mark before deploying a public production site.

## Maintenance

To update a future QS release:

1. Edit `src/data/universities.json`.
2. Keep `rank2027`, `rank2026`, `region`, `latitude`, `longitude`, `tuition`, `currency`, `logoPath`, `officialWebsite`, and `qsSource` populated.
3. Replace or add marker assets in `public/logos/qs/` and update `src/data/qs-logo-sources.json` if the source changes.
4. Run `npm run build` before deployment.
