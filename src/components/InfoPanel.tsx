import { ExternalLink, GraduationCap, List, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Language, University } from "../types";
import { assetPath } from "../utils/asset";
import { formatMoney } from "../utils/format";
import {
  getLocalizedCountry,
  getLocalizedLocation,
  getLocalizedRegion,
  getLocalizedTuitionAssumption,
  getLocalizedTuitionLabel,
  getLocalizedUniversityName,
  getUiString
} from "../utils/i18n";
import { searchUniversities } from "../utils/universitySearch";

type InfoPanelProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  activeUniversity: University | null;
  universities: University[];
  onSelectUniversity: (university: University) => void;
  onShowRankingList: () => void;
};

const LIST_COUNTRY_LABELS_EN: Record<string, string> = {
  "China (Mainland)": "China",
  "Hong Kong SAR, China": "HK",
  "United Kingdom": "UK",
  "United States of America": "USA"
};

function getListCountryLabel(university: University, language: Language): string {
  if (language === "zh") return getLocalizedCountry(university.country, language);
  return LIST_COUNTRY_LABELS_EN[university.country] ?? university.country;
}

export function InfoPanel({
  language,
  onLanguageChange,
  activeUniversity,
  universities,
  onSelectUniversity,
  onShowRankingList
}: InfoPanelProps) {
  const [query, setQuery] = useState("");
  const filteredUniversities = useMemo(() => searchUniversities(universities, query), [query, universities]);

  return (
    <aside
      className="info-panel"
      aria-label={activeUniversity ? getUiString(language, "title") : getUiString(language, "rankingList")}
    >
      <div className="panel-header">
        <div className="panel-header-main">
          <div className="rank-chip">{activeUniversity ? `QS ${activeUniversity.rank2027}` : getUiString(language, "listChip")}</div>
          {activeUniversity ? (
            <img src={assetPath(activeUniversity.logoPath)} alt="" className="panel-logo" />
          ) : (
            <div className="panel-logo panel-logo-placeholder">
              <List size={22} />
            </div>
          )}
        </div>
        <div className="language-toggle" role="group" aria-label="Language switcher">
          <button
            type="button"
            className={language === "zh" ? "is-active" : ""}
            onClick={() => onLanguageChange("zh")}
          >
            {getUiString(language, "languageChinese")}
          </button>
          <button
            type="button"
            className={language === "en" ? "is-active" : ""}
            onClick={() => onLanguageChange("en")}
          >
            {getUiString(language, "languageEnglish")}
          </button>
        </div>
      </div>

      <h1>{getUiString(language, "title")}</h1>
      <p className="lede">{getUiString(language, "lede")}</p>

      {activeUniversity ? (
        <div className="selected-card">
          <button className="panel-secondary-button" type="button" onClick={onShowRankingList}>
            <List size={15} />
            {getUiString(language, "backToList")}
          </button>

          <div>
            <p className="region-subtitle eyebrow">{getLocalizedRegion(activeUniversity.region, language)}</p>
            <h2>{getLocalizedUniversityName(activeUniversity, language)}</h2>
          </div>

          <dl className="detail-list">
            <div>
              <dt>
                <MapPin size={15} />
                {getUiString(language, "location")}
              </dt>
              <dd>{getLocalizedLocation(activeUniversity, language)}</dd>
            </div>
            <div>
              <dt>
                <GraduationCap size={15} />
                {getUiString(language, "annualTuition")}
              </dt>
              <dd>
                {formatMoney(activeUniversity.tuition.amount, activeUniversity.tuition.currency, language)}
                <span>{getLocalizedTuitionLabel(activeUniversity.tuition.label, language)}</span>
              </dd>
            </div>
            <div>
              <dt>{getUiString(language, "ranking2027")}</dt>
              <dd>{activeUniversity.rank2027}</dd>
            </div>
            <div>
              <dt>{getUiString(language, "ranking2026")}</dt>
              <dd>{activeUniversity.rank2026 || getUiString(language, "notRanked")}</dd>
            </div>
          </dl>

          <p className="assumption">{getLocalizedTuitionAssumption(activeUniversity.tuition.assumption, language)}</p>

          <div className="source-links">
            <a href={activeUniversity.officialWebsite} target="_blank" rel="noreferrer">
              {getUiString(language, "officialWebsite")}
              <ExternalLink size={13} />
            </a>
            <a href={activeUniversity.qsSource} target="_blank" rel="noreferrer">
              {getUiString(language, "qsSource")}
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      ) : (
        <div className="ranking-panel">
          <label className="search-field">
            <Search size={16} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={getUiString(language, "searchPlaceholder")}
              aria-label={getUiString(language, "searchAria")}
            />
          </label>

          <div className="ranking-list-header">
            <span>{query.trim() ? getUiString(language, "searchResults") : getUiString(language, "rankingList")}</span>
            <span>{filteredUniversities.length}</span>
          </div>

          {filteredUniversities.length > 0 ? (
            <ol className="ranking-list">
              {filteredUniversities.map((university) => (
                <li key={university.name}>
                  <button type="button" onClick={() => onSelectUniversity(university)}>
                    <span>QS {university.rank2027}</span>
                    <img src={assetPath(university.logoPath)} alt={`${getLocalizedUniversityName(university, language)} logo`} />
                    <strong className="ranking-list-school">
                      <span>{getLocalizedUniversityName(university, language)}</span>
                      <small>{getListCountryLabel(university, language)}</small>
                    </strong>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-results">{getUiString(language, "noMatches")}</div>
          )}
        </div>
      )}
    </aside>
  );
}
