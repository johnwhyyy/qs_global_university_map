# QS World Best Universities Map

Interactive, static-hostable React visualization of the top 100 QS 2027 universities on a minimalist 3D globe.

On first load, the side panel shows a scrollable QS ranking list instead of a preselected school. Users can choose a school from the list, search by university name or region, or click a marker on the globe to open the school detail view.

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

## Interface

The left side panel has two states:

- Ranking list: the default view, sorted by 2027 QS ranking. Each row shows the 2027 rank and university name.
- Detail view: opens after selecting a school and shows region, location, annual tuition, 2027 rank, 2026 rank, official website, and QS source.

The search field filters the ranking list as the user types. Search is case-insensitive and matches university name, region, city, country, and rank. Selecting a search result uses the same shared selection flow as selecting a ranking-list row.

Selecting from the ranking list or search recenters the globe on the selected campus at a readable altitude. Clicking a globe marker keeps the existing marker behavior: it selects the school and shows the detail card without using the side-panel zoom target.

## Map Behavior

University markers use campus latitude and longitude from `src/data/universities.json`. The globe projects those coordinates into screen space, clusters visually overlapping markers, and shows a `+n` badge for hidden schools in a cluster. The cluster uses the highest-ranked school logo as its visible marker.

The selected university marker is highlighted in the same green used by the Region subtitle. If the selected university is currently inside a cluster, the cluster marker receives the active highlight.

## Deploy

### Vercel

1. Import the repository in Vercel.
2. Set the build command to `npm run build`.
3. Set the output directory to `dist`.

This project owns the `www.aceuniversitymap.cn` custom domain. Its Vercel
rewrites keep the map app at the domain root and proxy `/majors` traffic to the
separate `uni_major_display` Vercel project.

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

- 2027 and 2026 QS rank, US News global rank, university name, city, country
- Region
- Campus latitude and longitude
- Annual tuition amount when available, currency, label, and assumptions
- Official website
- Marker logo path
- QS, US News, logo, official website, and coordinate source links

The QS ranking and region values are sourced from `2027 QS World University Rankings.xlsx`, using rows 4 through 103. The app also includes the U.S. News Best Global Universities top 100 as `usNewsGlobalRank`. The current dataset renders 130 university records: the QS top 100 plus U.S. News top-100 institutions not already present in the QS set.

The app keeps the ranking source URLs in the row data for reference:

- https://www.topuniversities.com/world-university-rankings
- https://www.usnews.com/education/best-global-universities/rankings?int=a27a09
- https://forum.chasedream.com/thread-1401143-1-1.html

Search and rank ordering helpers live in `src/utils/universitySearch.ts`, so future data updates do not require changing component-level filtering logic.

## Tuition Assumptions

Tuition varies by residency, course, school, and whether fees are quoted as tuition only or full cost of attendance. To keep the visualization comparable and readable, each record uses one representative annual figure:

- US universities: undergraduate tuition only, excluding room, board, insurance, fees, books, travel, and personal expenses unless noted.
- UK universities: representative overseas undergraduate tuition because overseas fees vary significantly by course.
- Singapore universities: representative international undergraduate tuition; tuition grant status is noted in the assumption.
- Hong Kong universities: non-local undergraduate tuition.
- China universities: representative international undergraduate tuition.
- ETH Zurich: two semesters of tuition plus the international surcharge; mandatory semester fees are excluded.
- UNSW Sydney: representative international undergraduate indicative annual tuition.

Medical or graduate-only institutions in the U.S. News expansion use an explicit "No standard undergraduate tuition" label rather than an invented undergraduate figure.

## Logos And Markers

The app uses local image assets in `public/logos/qs/`. Existing QS-sourced images are preserved for the original top-ranked records. For expanded records where profile scraping was unavailable from the local environment, generated local placeholder SVGs are stored in the same folder so the deployed app remains self-contained and does not hotlink assets. U.S. News-only records currently use `public/logos/qs/us-news-placeholder.svg` until licensed local university logo assets are added.

Logo source metadata, local paths, dimensions, and notes are recorded in `src/data/qs-logo-sources.json`. Confirm permission to use each university mark before deploying a public production site.

## Maintenance

To update a future QS release:

1. Edit `src/data/universities.json`.
2. Keep `rank2027`, `rank2026`, `usNewsGlobalRank`, `region`, `latitude`, `longitude`, `tuition`, `currency`, `logoPath`, `officialWebsite`, `qsSource`, and `usNewsSource` populated where applicable.
3. Replace or add marker assets in `public/logos/qs/` and update `src/data/qs-logo-sources.json` if the source changes.
4. Run `npm run build` before deployment.

When expanding or replacing the dataset, preserve the same field names so the ranking list, search, detail panel, clustering, and marker highlighting continue to work without component changes.
