let d3 = require('d3/dist/d3.js');

// generateScale()
// Create a linear scaling function for a numeric data field.
// Range will go from `min` to `max`, with invalid (non-numeric) values at `invalid`.
// If `area` is specified, range will be scaled such that every point on average fills `area` square units.
export function generateScale(arr, field, {area = null, min = -0.5, max = 0.5, invalid = 0.7}) {
  const size = area ? Math.sqrt(arr.length * area) : 1;
  const domain = d3.extent(arr, n => n[field]);
  const scale = d3.scaleLinear().domain(domain).range([size * min, size * max]);
  return n => {
    const val = n[field];
    if (!isNaN(parseFloat(val)) && isFinite(val)) {
      return scale(val);
    }
    return size * invalid;
  }
}

export function generateSizeScale(arr, field, size) {
  if (field === 'None') {
    return () => 250 * size;
  }
  const sizeScale = generateScale(arr, field, {min: 3, max: 500*500, invalid: 2});
  return d => Math.sqrt(sizeScale(d)) * size;
}
