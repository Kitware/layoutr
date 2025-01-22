import * as d3 from 'd3';

export type SimLink = d3.SimulationLinkDatum<d3.SimulationNodeDatum>;
export type SimNode = d3.SimulationNodeDatum;

export type Link = {
  source: Node;
  target: Node;
  weight: number;
} & {
  [key: string]: number | string;
};

export type Graph = {
  nodes: Node[];
  links: Link[];
};

export type Node = {
  id: number | string;
  degree: number;
  index: number;
  [key: string]: number | string;
};

export type SerializedLink = {
  source: number | string;
  target: number | string;
  [key: string]: number | string;
};

export type SerializedGraph = {
  nodes: Node[];
  links: SerializedLink[];
  edges?: SerializedLink[];
};
