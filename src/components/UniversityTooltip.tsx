import type { HoverState } from "../types";
import { formatCoordinates, formatMoney } from "../utils/format";

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
        <span>QS {university.rank}</span>
        <img src={university.logoPath} alt="" />
      </div>
      <h3>{university.name}</h3>
      <p>
        {university.city}, {university.country}
      </p>
      <dl>
        <div>
          <dt>Annual tuition</dt>
          <dd>{formatMoney(university.tuition.amount, university.tuition.currency)}</dd>
        </div>
        <div>
          <dt>Tuition basis</dt>
          <dd>{university.tuition.label}</dd>
        </div>
        <div>
          <dt>Coordinates</dt>
          <dd>{formatCoordinates(university.latitude, university.longitude)}</dd>
        </div>
      </dl>
    </div>
  );
}
