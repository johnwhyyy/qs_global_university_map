import { ExternalLink, GraduationCap, MapPin } from "lucide-react";
import type { University } from "../types";
import { assetPath } from "../utils/asset";
import { formatCoordinates, formatMoney } from "../utils/format";

type InfoPanelProps = {
  activeUniversity: University;
  total: number;
};

export function InfoPanel({ activeUniversity, total }: InfoPanelProps) {
  return (
    <aside className="info-panel" aria-label="Selected university details">
      <div className="panel-header">
        <div className="rank-chip">QS {activeUniversity.rank}</div>
        <img src={assetPath(activeUniversity.logoPath)} alt="" className="panel-logo" />
      </div>

      <h1>QS World University Rankings 2027</h1>
      <p className="lede">
        A source-backed 3D view of the current top {total} institutions, plotted at campus-level coordinates.
      </p>

      <div className="selected-card">
        <div>
          <p className="eyebrow">Selected university</p>
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
            <dt>Coordinates</dt>
            <dd>{formatCoordinates(activeUniversity.latitude, activeUniversity.longitude)}</dd>
          </div>
        </dl>

        <p className="assumption">{activeUniversity.tuition.assumption}</p>

        <div className="source-links">
          <a href={activeUniversity.qsSource} target="_blank" rel="noreferrer">
            QS source
            <ExternalLink size={13} />
          </a>
          <a href={activeUniversity.tuitionSource} target="_blank" rel="noreferrer">
            Tuition source
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </aside>
  );
}
