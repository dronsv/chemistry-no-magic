interface Props {
  symbolA: string;
  symbolB: string;
  polar: boolean;
}

const LEFT_CX = 110;
const RIGHT_CX = 190;
const ATOM_CY = 70;
const ATOM_R = 35;

export default function BondDiagramCovalent({ symbolA, symbolB, polar }: Props) {
  const overlapMidX = (LEFT_CX + RIGHT_CX) / 2;

  return (
    <svg
      viewBox="0 0 300 160"
      width="100%"
      role="img"
      aria-label={`Ковалентная ${polar ? 'полярная' : 'неполярная'} связь: ${symbolA}–${symbolB}`}
    >
      {/* Atom A */}
      <circle
        cx={LEFT_CX}
        cy={ATOM_CY}
        r={ATOM_R}
        fill="#e0e7ff"
        stroke="#4338ca"
        strokeWidth={2}
        opacity={0.85}
      />
      <text
        x={LEFT_CX - 10}
        y={ATOM_CY + 6}
        textAnchor="middle"
        fontSize={18}
        fontWeight={600}
        fill="#312e81"
      >
        {symbolA}
      </text>

      {/* Atom B */}
      <circle
        cx={RIGHT_CX}
        cy={ATOM_CY}
        r={ATOM_R}
        fill="#e0e7ff"
        stroke="#4338ca"
        strokeWidth={2}
        opacity={0.85}
      />
      <text
        x={RIGHT_CX + 10}
        y={ATOM_CY + 6}
        textAnchor="middle"
        fontSize={18}
        fontWeight={600}
        fill="#312e81"
      >
        {symbolB}
      </text>

      {/* Shared electron pair in overlap zone */}
      <circle cx={overlapMidX - 5} cy={ATOM_CY} r={3} fill="#4338ca" />
      <circle cx={overlapMidX + 5} cy={ATOM_CY} r={3} fill="#4338ca" />

      {/* Polarity labels */}
      {polar && (
        <>
          <text
            x={LEFT_CX - 10}
            y={ATOM_CY - ATOM_R - 8}
            textAnchor="middle"
            fontSize={14}
            fontWeight={600}
            fill="#4338ca"
          >
            δ+
          </text>
          <text
            x={RIGHT_CX + 10}
            y={ATOM_CY - ATOM_R - 8}
            textAnchor="middle"
            fontSize={14}
            fontWeight={600}
            fill="#dc2626"
          >
            δ−
          </text>
        </>
      )}

      {/* Bond type label */}
      <text
        x={150}
        y={148}
        textAnchor="middle"
        fontSize={12}
        fill="var(--color-text-muted, #6b7280)"
      >
        {polar ? 'Ковалентная полярная' : 'Ковалентная неполярная'}
      </text>
    </svg>
  );
}
