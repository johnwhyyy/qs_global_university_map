import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  const hoverCloseTimer = useRef<number | null>(null);

  useEffect(() => {
    document.title = "QS World Best Universities Map";
  }, []);

  const rankedUniversities = useMemo(() => sortByRank(universities), []);

  const cancelHoverClose = () => {
    if (hoverCloseTimer.current !== null) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  };

  const showHover = (nextHover: HoverState) => {
    cancelHoverClose();
    setHover(nextHover);
  };

  const scheduleHoverClose = () => {
    cancelHoverClose();
    hoverCloseTimer.current = window.setTimeout(() => {
      setHover(null);
      hoverCloseTimer.current = null;
    }, 180);
  };

  useEffect(() => () => cancelHoverClose(), []);

  const handleUniversitySelection = (university: University, options: { focusGlobe?: boolean } = {}) => {
    setActiveUniversity(university);
    if (options.focusGlobe) {
      setPanelFocusRequest({ university, id: Date.now() });
    }
  };

  return (
    <main className="app-shell">
      <InfoPanel
        activeUniversity={activeUniversity}
        universities={rankedUniversities}
        onSelectUniversity={(university) => handleUniversitySelection(university, { focusGlobe: true })}
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
          onSelect={(university) => handleUniversitySelection(university)}
          onHover={showHover}
          onHoverEnd={scheduleHoverClose}
        />
      </Suspense>
      <UniversityTooltip
        hover={hover}
        onSelectUniversity={(university) => handleUniversitySelection(university, { focusGlobe: true })}
        onPointerEnter={cancelHoverClose}
        onPointerLeave={scheduleHoverClose}
      />
    </main>
  );
}
