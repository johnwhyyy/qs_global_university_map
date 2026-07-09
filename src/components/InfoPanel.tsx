import { ExternalLink, GraduationCap, List, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { University } from "../types";
import { assetPath } from "../utils/asset";
import { formatMoney } from "../utils/format";
import { searchUniversities } from "../utils/universitySearch";

type InfoPanelProps = {
  activeUniversity: University | null;
  universities: University[];
  onSelectUniversity: (university: University) => void;
  onShowRankingList: () => void;
};

export function InfoPanel({
  activeUniversity,
  universities,
  onSelectUniversity,
  onShowRankingList
}: InfoPanelProps) {
  const [query, setQuery] = useState("");
  const filteredUniversities = useMemo(() => searchUniversities(universities, query), [query, universities]);

  return (
    <aside className="info-panel" aria-label={activeUniversity ? "Selected university details" : "QS ranking list"}>
      <div className="panel-header">
        <div className="rank-chip">{activeUniversity ? `QS ${activeUniversity.rank2027}` : "QS top 100"}</div>
        {activeUniversity ? (
          <img src={assetPath(activeUniversity.logoPath)} alt="" className="panel-logo" />
        ) : (
          <div className="panel-logo panel-logo-placeholder">
            <List size={22} />
          </div>
        )}
      </div>

      <h1>QS World Best Universities Map</h1>
      <p className="lede">
        Top universities in the world according to QS 2027 world university ranking.
      </p>

      {activeUniversity ? (
        <div className="selected-card">
          <button className="panel-secondary-button" type="button" onClick={onShowRankingList}>
            <List size={15} />
            Go back to full ranking list
          </button>

          <div>
            <p className="region-subtitle eyebrow">{activeUniversity.region}</p>
            <h2>{activeUniversity.name}</h2>
          </div>

          <dl className="detail-list">
            <div>
              <dt>
                <MapPin size={15} />
                Location
              </dt>
              <dd>
                {activeUniversity.city}, {activeUniversity.country}
              </dd>
            </div>
            <div>
              <dt>
                <GraduationCap size={15} />
                Annual tuition
              </dt>
              <dd>
                {formatMoney(activeUniversity.tuition.amount, activeUniversity.tuition.currency)}
                <span>{activeUniversity.tuition.label}</span>
              </dd>
            </div>
            <div>
              <dt>2027 Ranking</dt>
              <dd>{activeUniversity.rank2027}</dd>
            </div>
            <div>
              <dt>2026 Ranking</dt>
              <dd>{activeUniversity.rank2026 || "Not ranked"}</dd>
            </div>
          </dl>

          <p className="assumption">{activeUniversity.tuition.assumption}</p>

          <div className="source-links">
            <a href={activeUniversity.officialWebsite} target="_blank" rel="noreferrer">
              Official website
              <ExternalLink size={13} />
            </a>
            <a href={activeUniversity.qsSource} target="_blank" rel="noreferrer">
              QS source
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
              placeholder="Search by university or region"
              aria-label="Search universities"
            />
          </label>

          <div className="ranking-list-header">
            <span>{query.trim() ? "Search results" : "QS ranking list"}</span>
            <span>{filteredUniversities.length}</span>
          </div>

          {filteredUniversities.length > 0 ? (
            <ol className="ranking-list">
              {filteredUniversities.map((university) => (
                <li key={university.name}>
                  <button type="button" onClick={() => onSelectUniversity(university)}>
                    <span>QS {university.rank2027}</span>
                    <img src={assetPath(university.logoPath)} alt={`${university.name} logo`} />
                    <strong>{university.name}</strong>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-results">No matching universities found</div>
          )}
        </div>
      )}
    </aside>
  );
}
