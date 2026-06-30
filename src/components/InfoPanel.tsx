import { ExternalLink, GraduationCap, MapPin } from "lucide-react";
import type { University } from "../types";
import { assetPath } from "../utils/asset";
import { formatCoordinates, formatMoney } from "../utils/format";

type InfoPanelProps = {
  activeUniversity: University;
};

export function InfoPanel({ activeUniversity }: InfoPanelProps) {
  return (
    <aside className="info-panel" aria-label="Selected university details">
      <div className="panel-header">
        <div className="rank-chip">QS {activeUniversity.rank2027}</div>
        <img src={assetPath(activeUniversity.logoPath)} alt="" className="panel-logo" />
      </div>

      <h1>QS World Best Universities Map</h1>
      <p className="lede">
        Top universities in the world according to QS 2027 world university ranking. Drag to rotate and pan. Scroll or
        pinch to zoom. Hover markers for tuition and school details.
      </p>

      <div className="selected-card">
        <div>
          <p className="eyebrow">{activeUniversity.region}</p>
          <h2>{activeUniversity.name}</h2>
        </div>

        <dl className="detail-list">
          <div>
            <dt>Region</dt>
            <dd>{activeUniversity.region}</dd>
          </div>
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
            <dd>{activeUniversity.rank2026}</dd>
          </div>
          <div>
            <dt>Coordinates</dt>
            <dd>{formatCoordinates(activeUniversity.latitude, activeUniversity.longitude)}</dd>
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
    </aside>
  );
}
