import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "../types";
import type { RegionName } from "../types/mapModeTypes";
import { getLocalizedRegion } from "../utils/i18n";

type RegionSelectorProps = {
  language: Language;
  regions: RegionName[];
  selectedRegion: RegionName | null;
  onSelectRegion: (region: RegionName | null) => void;
};

const CONTINENT_REGIONS: RegionName[] = ["Americas", "Asia", "Europe", "Oceania"];

export function RegionSelector({ language, regions, selectedRegion, onSelectRegion }: RegionSelectorProps) {
  const [isContinentMenuOpen, setIsContinentMenuOpen] = useState(false);
  const continentMenuRef = useRef<HTMLDivElement | null>(null);
  const continents = useMemo(
    () => CONTINENT_REGIONS.filter((region) => regions.includes(region)),
    [regions]
  );
  const displayRegions = useMemo(
    () => regions.filter((region) => !CONTINENT_REGIONS.includes(region)),
    [regions]
  );
  const selectedContinent = selectedRegion && continents.includes(selectedRegion) ? selectedRegion : null;

  useEffect(() => {
    if (!isContinentMenuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!continentMenuRef.current?.contains(event.target as Node)) {
        setIsContinentMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsContinentMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isContinentMenuOpen]);

  return (
    <nav className="region-selector" aria-label="Region map navigation">
      <button
        type="button"
        className={selectedRegion === null ? "is-active" : ""}
        onClick={() => onSelectRegion(null)}
      >
        {language === "zh" ? "全球" : "Global"}
      </button>
      <div className="region-menu" ref={continentMenuRef}>
        <button
          type="button"
          className={selectedContinent ? "is-active" : ""}
          aria-haspopup="menu"
          aria-expanded={isContinentMenuOpen}
          onClick={() => setIsContinentMenuOpen((isOpen) => !isOpen)}
        >
          {language === "zh" ? "按大洲" : "By continent"}
          <ChevronDown size={14} />
        </button>
        {isContinentMenuOpen ? (
          <div className="region-menu-popover" role="menu">
            {continents.map((region) => (
              <button
                key={region}
                type="button"
                role="menuitemradio"
                aria-checked={selectedRegion === region}
                className={selectedRegion === region ? "is-active" : ""}
                onClick={() => {
                  onSelectRegion(region);
                  setIsContinentMenuOpen(false);
                }}
              >
                {getLocalizedRegion(region, language)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {displayRegions.map((region) => (
        <button
          key={region}
          type="button"
          className={selectedRegion === region ? "is-active" : ""}
          onClick={() => onSelectRegion(region)}
        >
          {getLocalizedRegion(region, language)}
        </button>
      ))}
    </nav>
  );
}
