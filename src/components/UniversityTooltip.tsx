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

  const { university, x, y } = hover;

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
