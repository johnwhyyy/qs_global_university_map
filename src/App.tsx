import { lazy, Suspense, useMemo, useState } from "react";
import { InfoPanel } from "./components/InfoPanel";
import { UniversityTooltip } from "./components/UniversityTooltip";
import universitiesData from "./data/universities.json";
import type { HoverState, University } from "./types";

const universities = universitiesData as University[];
const UniversityGlobe = lazy(() =>
  import("./components/UniversityGlobe").then((module) => ({ default: module.UniversityGlobe }))
);

export default function App() {
  const [activeUniversity, setActiveUniversity] = useState<University>(universities[0]);
  const [hover, setHover] = useState<HoverState>(null);

  const rankedUniversities = useMemo(
    () =>
      [...universities].sort((a, b) => {
        const rankA = Number(a.rank.replace("=", ""));
        const rankB = Number(b.rank.replace("=", ""));
        return rankA - rankB || a.name.localeCompare(b.name);
      }),
    []
  );

  return (
    <main className="app-shell">
      <InfoPanel activeUniversity={activeUniversity} total={rankedUniversities.length} />
      <Suspense
        fallback={
          <section className="globe-stage globe-loading" aria-label="Loading interactive globe">
            <span>Loading globe</span>
          </section>
        }
      >
        <UniversityGlobe
          universities={rankedUniversities}
          activeUniversity={activeUniversity}
          onSelect={setActiveUniversity}
          onHover={setHover}
        />
      </Suspense>
      <UniversityTooltip hover={hover} />
    </main>
  );
}
