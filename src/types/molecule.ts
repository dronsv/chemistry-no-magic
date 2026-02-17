export interface MoleculeAtom {
  id: string;
  symbol: string;
  x: number;
  y: number;
  ox?: number;
  lonePairs?: number;
  label?: string;
}

export interface MoleculeBond {
  from: string;
  to: string;
  order: 1 | 2 | 3;
  dative?: boolean;
}

export interface MoleculePolarity {
  from: string;
  to: string;
  deltaPlus: string;
  deltaMinus: string;
}

export interface MoleculeStructure {
  id: string;
  atoms: MoleculeAtom[];
  bonds: MoleculeBond[];
  polarity?: MoleculePolarity[];
}

export interface MoleculeLayerVisibility {
  bonds?: boolean;
  oxStates?: boolean;
  charges?: boolean;
  lonePairs?: boolean;
}
