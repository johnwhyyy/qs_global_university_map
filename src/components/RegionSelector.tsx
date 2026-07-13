import type { Language } from "../types";
import type { RegionName } from "../types/mapModeTypes";
import { getLocalizedRegion } from "../utils/i18n";

type RegionSelectorProps = {
  language: Language;
  regions: RegionName[];
  selectedRegion: RegionName | null;
  onSelectRegion: (region: RegionName | null) => void;
};

export function RegionSelector({ language, regions, selectedRegion, onSelectRegion }: RegionSelectorProps) {
  return (
    <nav className="region-selector" aria-label="Region map navigation">
      <button
        type="button"
        className={selectedRegion === null ? "is-active" : ""}
        onClick={() => onSelectRegion(null)}
      >
        {language === "zh" ? "全球" : "Global"}
      </button>
      {regions.map((region) => (
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
