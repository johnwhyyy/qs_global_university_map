import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { InfoPanel } from "./components/InfoPanel";
import { RegionMap } from "./components/RegionMap";
import { RegionSelector } from "./components/RegionSelector";
import { UniversityTooltip } from "./components/UniversityTooltip";
import universitiesData from "./data/universities.json";
import type { HoverState, Language, University } from "./types";
import type { MapMode, RegionName } from "./types/mapModeTypes";
import { getUiString } from "./utils/i18n";
import { sortByRank } from "./utils/universitySearch";

const universities = universitiesData as University[];
const UniversityGlobe = lazy(() =>
  import("./components/UniversityGlobe").then((module) => ({ default: module.UniversityGlobe }))
);

export default function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [activeUniversity, setActiveUniversity] = useState<University | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionName | null>(null);
  const [panelFocusRequest, setPanelFocusRequest] = useState<{ university: University; id: number } | null>(null);
  const [globeListResetRequest, setGlobeListResetRequest] = useState(0);
  const [regionFocusRequest, setRegionFocusRequest] = useState<{ university: University; id: number } | null>(null);
  const [hover, setHover] = useState<HoverState>(null);
  const hoverCloseTimer = useRef<number | null>(null);

  useEffect(() => {
    document.title = getUiString(language, "title");
  }, [language]);

  const rankedUniversities = useMemo(() => sortByRank(universities), []);
  const regions = useMemo(
    () => [...new Set(rankedUniversities.map((university) => university.region))].sort() as RegionName[],
    [rankedUniversities]
  );
  const mapMode: MapMode = selectedRegion ? "region" : "global";

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
    if (selectedRegion && university.region !== selectedRegion) {
      setSelectedRegion(university.region as RegionName);
    }
    if (options.focusGlobe) {
      setPanelFocusRequest({ university, id: Date.now() });
    }
  };

  const handleSideListUniversitySelection = (university: University) => {
    setActiveUniversity(university);

    if (!selectedRegion) {
      setPanelFocusRequest({ university, id: Date.now() });
      return;
    }

    if (university.region !== selectedRegion) {
      setSelectedRegion(null);
      setPanelFocusRequest({ university, id: Date.now() });
      return;
    }

    setRegionFocusRequest({ university, id: Date.now() });
  };

  const handleRegionSelection = (region: RegionName | null) => {
    setHover(null);
    setSelectedRegion(region);
  };

  const handleShowRankingList = () => {
    setActiveUniversity(null);
    if (!selectedRegion) {
      setGlobeListResetRequest((request) => request + 1);
    }
  };

  return (
    <main className="app-shell">
      <InfoPanel
        language={language}
        onLanguageChange={setLanguage}
        activeUniversity={activeUniversity}
        universities={rankedUniversities}
        onSelectUniversity={handleSideListUniversitySelection}
        onShowRankingList={handleShowRankingList}
      />
      <Suspense
        fallback={
          <section className="globe-stage globe-loading" aria-label="Loading interactive globe">
            <span>{getUiString(language, "loadingGlobe")}</span>
          </section>
        }
      >
        <section className="visualization-panel">
          <RegionSelector
            language={language}
            regions={regions}
            selectedRegion={selectedRegion}
            onSelectRegion={handleRegionSelection}
          />
          {mapMode === "region" && selectedRegion ? (
            <RegionMap
              universities={rankedUniversities}
              region={selectedRegion}
              language={language}
              activeUniversity={activeUniversity}
              focusRequest={regionFocusRequest}
              onSelect={(university) => handleUniversitySelection(university)}
              onHover={showHover}
              onHoverEnd={scheduleHoverClose}
            />
          ) : (
            <UniversityGlobe
              universities={rankedUniversities}
              language={language}
              activeUniversity={activeUniversity}
              panelFocusRequest={panelFocusRequest}
              listResetRequest={globeListResetRequest}
              onSelect={(university) => handleUniversitySelection(university)}
              onHover={showHover}
              onHoverEnd={scheduleHoverClose}
            />
          )}
        </section>
      </Suspense>
      <UniversityTooltip
        language={language}
        hover={hover}
        onSelectUniversity={(university) => handleUniversitySelection(university, { focusGlobe: true })}
        onPointerEnter={cancelHoverClose}
        onPointerLeave={scheduleHoverClose}
      />
    </main>
  );
}
