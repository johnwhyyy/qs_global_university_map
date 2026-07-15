import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { InfoPanel } from "./components/InfoPanel";
import { RegionMap } from "./components/RegionMap";
import { RegionSelector } from "./components/RegionSelector";
import { UniversityTooltip } from "./components/UniversityTooltip";
import universitiesData from "./data/universities.json";
import type { HoverState, Language, RankingSource, University } from "./types";
import type { MapMode, RegionName } from "./types/mapModeTypes";
import { assetPath } from "./utils/asset";
import { getLocalizedUniversityName, getUiString } from "./utils/i18n";
import { getRankForSource, getRankLabelForSource, sortByRank } from "./utils/universitySearch";

const universities = universitiesData as University[];
const UniversityGlobe = lazy(() =>
  import("./components/UniversityGlobe").then((module) => ({ default: module.UniversityGlobe }))
);

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);

    updateIsMobile();
    mediaQuery.addEventListener("change", updateIsMobile);
    return () => mediaQuery.removeEventListener("change", updateIsMobile);
  }, []);

  return isMobile;
}

function getBrowserDefaultLanguage(): Language {
  if (typeof navigator === "undefined") return "en";

  const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return browserLanguages.some((browserLanguage) => browserLanguage.toLowerCase().startsWith("zh")) ? "zh" : "en";
}

export default function App() {
  const [language, setLanguage] = useState<Language>(() => getBrowserDefaultLanguage());
  const [activeUniversity, setActiveUniversity] = useState<University | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionName | null>(null);
  const [panelFocusRequest, setPanelFocusRequest] = useState<{ university: University; id: number } | null>(null);
  const [globeListResetRequest, setGlobeListResetRequest] = useState(0);
  const [regionFocusRequest, setRegionFocusRequest] = useState<{ university: University; id: number } | null>(null);
  const [hover, setHover] = useState<HoverState>(null);
  const [mobileCluster, setMobileCluster] = useState<University[] | null>(null);
  const [rankingSource, setRankingSource] = useState<RankingSource>("qs");
  const hoverCloseTimer = useRef<number | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    document.title = getUiString(language, "title");
  }, [language]);

  const rankedUniversities = useMemo(
    () => sortByRank(universities.filter((university) => getRankForSource(university, rankingSource)), rankingSource),
    [rankingSource]
  );
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
    if (isMobile) return;
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

  useEffect(() => {
    if (!isMobile) {
      setMobileCluster(null);
    }
  }, [isMobile]);

  useEffect(() => {
    if (activeUniversity && !getRankForSource(activeUniversity, rankingSource)) {
      setActiveUniversity(null);
      setHover(null);
      setMobileCluster(null);
    }
  }, [activeUniversity, rankingSource]);

  useEffect(() => {
    if (selectedRegion && !regions.includes(selectedRegion)) {
      setSelectedRegion(null);
    }
  }, [regions, selectedRegion]);

  const handleUniversitySelection = (university: University, options: { focusGlobe?: boolean } = {}) => {
    setMobileCluster(null);
    setActiveUniversity(university);
    if (selectedRegion && university.region !== selectedRegion) {
      setSelectedRegion(university.region as RegionName);
    }
    if (options.focusGlobe) {
      setPanelFocusRequest({ university, id: Date.now() });
    }
  };

  const handleSideListUniversitySelection = (university: University) => {
    setMobileCluster(null);
    setActiveUniversity(university);

    if (!selectedRegion) {
      setPanelFocusRequest({ university, id: Date.now() });
      return;
    }

    if (university.region !== selectedRegion) {
      setSelectedRegion(null);
      window.requestAnimationFrame(() => {
        setPanelFocusRequest({ university, id: Date.now() });
      });
      return;
    }

    setRegionFocusRequest({ university, id: Date.now() });
  };

  const handleRegionSelection = (region: RegionName | null) => {
    setHover(null);
    setMobileCluster(null);
    setSelectedRegion(region);
  };

  const handleShowRankingList = () => {
    setMobileCluster(null);
    setActiveUniversity(null);
    if (!selectedRegion) {
      setGlobeListResetRequest((request) => request + 1);
    }
  };

  const openMobileCluster = (clusterUniversities: University[]) => {
    setHover(null);
    setMobileCluster(clusterUniversities);
  };

  return (
    <main className="app-shell">
      <InfoPanel
        language={language}
        onLanguageChange={setLanguage}
        rankingSource={rankingSource}
        onRankingSourceChange={setRankingSource}
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
              rankingSource={rankingSource}
              activeUniversity={activeUniversity}
              focusRequest={regionFocusRequest}
              onSelect={(university) => handleUniversitySelection(university)}
              onClusterSelect={isMobile ? openMobileCluster : undefined}
              onHover={showHover}
              onHoverEnd={scheduleHoverClose}
            />
          ) : (
            <UniversityGlobe
              universities={rankedUniversities}
              language={language}
              rankingSource={rankingSource}
              activeUniversity={activeUniversity}
              panelFocusRequest={panelFocusRequest}
              listResetRequest={globeListResetRequest}
              onSelect={(university) => handleUniversitySelection(university)}
              onClusterSelect={isMobile ? openMobileCluster : undefined}
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
      {mobileCluster ? (
        <div className="mobile-cluster-layer" role="presentation" onClick={() => setMobileCluster(null)}>
          <section
            className="mobile-cluster-sheet"
            aria-label={getUiString(language, "clusterTitle")}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-cluster-header">
              <div>
                <span>
                  {mobileCluster.length}
                  {language === "zh" ? getUiString(language, "schools") : ` ${getUiString(language, "schools")}`}
                </span>
                <h3>{getUiString(language, "clusterTitle")}</h3>
              </div>
              <button type="button" onClick={() => setMobileCluster(null)} aria-label="Close cluster list">
                x
              </button>
            </div>
            <ol className="mobile-cluster-list">
              {mobileCluster.map((university) => (
                <li key={university.name}>
                  <button type="button" onClick={() => handleUniversitySelection(university)}>
                    <span>{getRankLabelForSource(university, rankingSource)}</span>
                    <img src={assetPath(university.logoPath)} alt="" />
                    <strong>{getLocalizedUniversityName(university, language)}</strong>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : null}
    </main>
  );
}
