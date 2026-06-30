# QS Top 20 Universities Globe

Interactive, static-hostable React visualization of the current top 20 institutions in the QS World University Rankings on a minimalist 3D globe.

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

- QS rank, university name, city, country
- Campus latitude and longitude
- Tuition amount, currency, label, and assumptions
- Marker logo path
- QS, tuition, and coordinate source links

The ranking is based on the current QS World University Rankings 2027 page from QS TopUniversities, accessed June 29, 2026:

- https://www.topuniversities.com/world-university-rankings

Because the QS page is dynamically rendered and may be rate-limited, the top-20 order was cross-checked against contemporary reporting of the QS 2027 table. The app uses the official QS page as the ranking source URL in the data file.

## Tuition Assumptions

Tuition varies by residency, course, school, and whether fees are quoted as tuition only or full cost of attendance. To keep the visualization comparable and readable, each record uses one representative annual figure:

- US universities: undergraduate tuition only, excluding room, board, insurance, fees, books, travel, and personal expenses unless noted.
- UK universities: representative overseas undergraduate tuition because overseas fees vary significantly by course.
- Singapore universities: representative international undergraduate tuition; tuition grant status is noted in the assumption.
- Hong Kong universities: non-local undergraduate tuition.
- China universities: representative international undergraduate tuition.
- ETH Zurich: two semesters of tuition plus the international surcharge; mandatory semester fees are excluded.
- UNSW Sydney: representative international undergraduate indicative annual tuition.

Every tuition value has a direct source URL in `src/data/universities.json` so figures can be audited or replaced when institutional fee tables change.

## Logos And Markers

The app uses local image assets in `public/logos/qs/` that were scraped from the corresponding QS TopUniversities profile pages. The scraped source URL, QS profile URL, local path, dimensions, and timestamp for each logo are recorded in `src/data/qs-logo-sources.json`.

The older monogram placeholder badges remain in `public/logos/` as fallback assets. The scraped QS files avoid hotlinking, but they do not remove trademark or licensing obligations. Confirm permission to use each university mark before deploying a public production site.

## Maintenance

To update a future QS release:

1. Edit `src/data/universities.json`.
2. Keep `rank`, `latitude`, `longitude`, `tuition`, `currency`, `logoPath`, `qsSource`, and `tuitionSource` populated.
3. Replace or add marker assets in `public/logos/qs/` and update `src/data/qs-logo-sources.json` if the source changes.
4. Run `npm run build` before deployment.
