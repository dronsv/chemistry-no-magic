import * as m from '../../../paraglide/messages.js';

interface Props {
  symbolA: string;
  symbolB: string;
}

const METAL_CX = 70;
const NONMETAL_CX = 230;
const ATOM_CY = 55;
const ATOM_R = 35;

export default function BondDiagramIonic({ symbolA, symbolB }: Props) {
  const arrowPathD = `M ${METAL_CX + ATOM_R + 4} ${ATOM_CY - 20} Q 150 ${ATOM_CY - 50} ${NONMETAL_CX - ATOM_R - 4} ${ATOM_CY - 20}`;

  return (
    <svg
      viewBox="0 0 300 160"
      width="100%"
      role="img"
      aria-label={m.bond_diagram_ionic_aria({ symbolA, symbolB })}
    >
      {/* Metal atom */}
      <circle
        cx={METAL_CX}
        cy={ATOM_CY}
        r={ATOM_R}
        fill="#dbeafe"
        stroke="#2563eb"
        strokeWidth={2}
      />
      <text
        x={METAL_CX}
        y={ATOM_CY + 6}
        textAnchor="middle"
        fontSize={18}
        fontWeight={600}
        fill="#1e40af"
      >
        {symbolA}
      </text>

      {/* Nonmetal atom */}
      <circle
        cx={NONMETAL_CX}
        cy={ATOM_CY}
        r={ATOM_R}
        fill="#fee2e2"
        stroke="#dc2626"
        strokeWidth={2}
      />
      <text
        x={NONMETAL_CX}
        y={ATOM_CY + 6}
        textAnchor="middle"
        fontSize={18}
        fontWeight={600}
        fill="#991b1b"
      >
        {symbolB}
      </text>

      {/* Curved electron transfer arrow */}
      <defs>
        <marker
          id="ionic-arrowhead"
          markerWidth={8}
          markerHeight={6}
          refX={7}
          refY={3}
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#6b7280" />
        </marker>
      </defs>
      <path
        d={arrowPathD}
        fill="none"
        stroke="#6b7280"
        strokeWidth={1.5}
        markerEnd="url(#ionic-arrowhead)"
      />
      <text
        x={150}
        y={ATOM_CY - 38}
        textAnchor="middle"
        fontSize={12}
        fill="var(--color-text-muted, #6b7280)"
      >
        e⁻
      </text>

      {/* Transfer arrow between atoms */}
      <text
        x={150}
        y={ATOM_CY + 6}
        textAnchor="middle"
        fontSize={20}
        fill="var(--color-text-muted, #6b7280)"
      >
        →
      </text>

      {/* Resulting ions */}
      <text
        x={METAL_CX}
        y={ATOM_CY + ATOM_R + 22}
        textAnchor="middle"
        fontSize={14}
        fontWeight={600}
        fill="#1e40af"
      >
        {symbolA}⁺
      </text>
      <text
        x={NONMETAL_CX}
        y={ATOM_CY + ATOM_R + 22}
        textAnchor="middle"
        fontSize={14}
        fontWeight={600}
        fill="#991b1b"
      >
        {symbolB}⁻
      </text>

      {/* Bond type label */}
      <text
        x={150}
        y={150}
        textAnchor="middle"
        fontSize={12}
        fill="var(--color-text-muted, #6b7280)"
      >
        {m.bond_diagram_ionic_label()}
      </text>
    </svg>
  );
}
