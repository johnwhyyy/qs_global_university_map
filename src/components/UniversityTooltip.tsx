import type { HoverState, Language, University } from "../types";
import { assetPath } from "../utils/asset";
import { formatMoney } from "../utils/format";
import {
  getLocalizedLocation,
  getLocalizedRegion,
  getLocalizedUniversityName,
  getUiString
} from "../utils/i18n";

type UniversityTooltipProps = {
  language: Language;
  hover: HoverState;
  onSelectUniversity: (university: University) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
};

function getPrimaryRankLabel(university: University): string {
  if (university.rank2027) return `QS ${university.rank2027}`;
  if (university.usNewsGlobalRank) return `USN ${university.usNewsGlobalRank}`;
  return "NR";
}

export function UniversityTooltip({
  language,
  hover,
  onSelectUniversity,
  onPointerEnter,
  onPointerLeave
}: UniversityTooltipProps) {
  if (!hover) {
    return null;
  }

  const { x, y } = hover;

  if (hover.type === "cluster") {
    return (
      <div
        className="tooltip-card tooltip-card-interactive"
        style={{
          left: `${x}px`,
          top: `${y}px`
        }}
        role="status"
        onMouseEnter={onPointerEnter}
        onMouseLeave={onPointerLeave}
      >
        <div className="tooltip-topline">
          <span>
            {hover.universities.length}
            {language === "zh" ? getUiString(language, "schools") : ` ${getUiString(language, "schools")}`}
          </span>
          <img src={assetPath(hover.universities[0].logoPath)} alt="" />
        </div>
        <h3>{getUiString(language, "clusterTitle")}</h3>
        <p>{getUiString(language, "clusterDescription")}</p>
        <ul className="cluster-list">
          {hover.universities.map((university) => (
            <li key={university.name}>
              <button type="button" onClick={() => onSelectUniversity(university)}>
                <span>{getPrimaryRankLabel(university)}</span>
                {getLocalizedUniversityName(university, language)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const { university } = hover;

  return (
    <div
      className="tooltip-card"
      style={{
        left: `${x}px`,
        top: `${y}px`
      }}
      role="status"
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
    >
      <div className="tooltip-topline">
        <span>{getPrimaryRankLabel(university)}</span>
        <img src={assetPath(university.logoPath)} alt="" />
      </div>
      <h3>{getLocalizedUniversityName(university, language)}</h3>
      <p>{getLocalizedRegion(university.region, language)}</p>
      <dl>
        <div>
          <dt>{getUiString(language, "location")}</dt>
          <dd>{getLocalizedLocation(university, language)}</dd>
        </div>
        <div>
          <dt>{getUiString(language, "annualTuition")}</dt>
          <dd>{formatMoney(university.tuition.amount, university.tuition.currency, language)}</dd>
        </div>
        <div>
          <dt>{getUiString(language, "ranking2027")}</dt>
          <dd>{university.rank2027 || getUiString(language, "notRanked")}</dd>
        </div>
        <div>
          <dt>{getUiString(language, "ranking2026")}</dt>
          <dd>{university.rank2026 || getUiString(language, "notRanked")}</dd>
        </div>
        <div>
          <dt>{getUiString(language, "usNewsGlobalRanking")}</dt>
          <dd>{university.usNewsGlobalRank || getUiString(language, "notRanked")}</dd>
        </div>
      </dl>
    </div>
  );
}
