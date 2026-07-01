import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { InfoPanel } from "./components/InfoPanel";
import { UniversityTooltip } from "./components/UniversityTooltip";
import universitiesData from "./data/universities.json";
import type { HoverState, University } from "./types";
import { sortByRank } from "./utils/universitySearch";

const universities = universitiesData as University[];
const UniversityGlobe = lazy(() =>
  import("./components/UniversityGlobe").then((module) => ({ default: module.UniversityGlobe }))
);

export default function App() {
  const [activeUniversity, setActiveUniversity] = useState<University | null>(null);
  const [panelFocusRequest, setPanelFocusRequest] = useState<{ university: University; id: number } | null>(null);
  const [hover, setHover] = useState<HoverState>(null);

  useEffect(() => {
    document.title = "QS World Best Universities Map";
  }, []);

  const rankedUniversities = useMemo(() => sortByRank(universities), []);

  const selectUniversityFromPanel = (university: University) => {
    setActiveUniversity(university);
    setPanelFocusRequest({ university, id: Date.now() });
  };

  return (
    <main className="app-shell">
      <InfoPanel
        activeUniversity={activeUniversity}
        universities={rankedUniversities}
        onSelectUniversity={selectUniversityFromPanel}
        onShowRankingList={() => setActiveUniversity(null)}
      />
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
          panelFocusRequest={panelFocusRequest}
          onSelect={setActiveUniversity}
          onHover={setHover}
        />
      </Suspense>
      <UniversityTooltip hover={hover} />
    </main>
  );
}
