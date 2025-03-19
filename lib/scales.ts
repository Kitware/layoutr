import * as d3 from 'd3';
import { Node, SimNode } from './types';

// generateScale()
// Create a linear scaling function for a numeric data field.
// Range will go from `min` to `max`, with invalid (non-numeric) values at `invalid`.
// If `area` is specified, range will be scaled such that every point on average fills `area` square units.
export const generateScale = (arr: Node[], field: string, {area = null, min = -0.5, max = 0.5, invalid = 0.7}: {area?: number | null, min?: number, max?: number, invalid?: number}) => {
  const size = area ? Math.sqrt(arr.length * area) : 1;
  const domain = d3.extent(arr, n => +n[field]) as [number, number];
  const scale = d3.scaleLinear().domain(domain).range([size * min, size * max]);
  return (n: SimNode, _index: number, _nodes: SimNode[]) => {
    const val = (n as Node)[field];
    if (!isNaN(+val) && isFinite(+val)) {
      return scale(+val);
    }
    return size * invalid;
  }
};

export const generateSizeScale = (arr: Node[], field: string | null, size: number) => {
  if (field === null) {
    return () => 250 * size;
  }
  const sizeScale = generateScale(arr, field, {min: 10*10, max: 500*500, invalid: 2});
  return (d: SimNode, index: number, nodes: SimNode[]) => Math.sqrt(sizeScale(d, index, nodes)) * size;
};
