import type { HoverState } from "../types";
import { assetPath } from "../utils/asset";
import { formatMoney } from "../utils/format";

type UniversityTooltipProps = {
  hover: HoverState;
};

export function UniversityTooltip({ hover }: UniversityTooltipProps) {
  if (!hover) {
    return null;
  }

  const { x, y } = hover;

  if (hover.type === "cluster") {
    return (
      <div
        className="tooltip-card"
        style={{
          left: `${x}px`,
          top: `${y}px`
        }}
        role="status"
      >
        <div className="tooltip-topline">
          <span>{hover.universities.length} schools</span>
          <img src={assetPath(hover.universities[0].logoPath)} alt="" />
        </div>
        <h3>Clustered universities</h3>
        <p>Overlapping markers at this zoom level</p>
        <ul className="cluster-list">
          {hover.universities.map((university) => (
            <li key={university.name}>
              <span>QS {university.rank2027}</span>
              {university.name}
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
    >
      <div className="tooltip-topline">
        <span>QS {university.rank2027}</span>
        <img src={assetPath(university.logoPath)} alt="" />
      </div>
      <h3>{university.name}</h3>
      <p>{university.region}</p>
      <dl>
        <div>
          <dt>Location</dt>
          <dd>
            {university.city}, {university.country}
          </dd>
        </div>
        <div>
          <dt>Annual tuition</dt>
          <dd>{formatMoney(university.tuition.amount, university.tuition.currency)}</dd>
        </div>
        <div>
          <dt>2027 Ranking</dt>
          <dd>{university.rank2027}</dd>
        </div>
        <div>
          <dt>2026 Ranking</dt>
          <dd>{university.rank2026}</dd>
        </div>
      </dl>
    </div>
  );
}
