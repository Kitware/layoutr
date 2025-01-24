#version 300 es
precision mediump float;

in vec4 vColor;
in vec2 vPosition;

in float vAntialiasDistance;
in highp float vStrokePosition;

uniform highp float uStrokeWidth;
uniform float uStrokeOpacity;

out vec4 outColor;

void main() {
  float dist = length(vPosition);
  if (uStrokeOpacity > 0.0 && uStrokeWidth > 0.0) {
    float radius = 1.0;
    if (dist > radius + vAntialiasDistance / 2.0) {
      discard;
    }
    float alpha = 1.0 - smoothstep(radius - vAntialiasDistance / 2.0, radius + vAntialiasDistance / 2.0, dist);
    vec3 strokeColor = vec3(0.0, 0.0, 0.0);
    float colorBlend = smoothstep(vStrokePosition - vAntialiasDistance / 2.0, vStrokePosition + vAntialiasDistance / 2.0, dist);
    outColor = vec4(mix(vColor.rgb, strokeColor, colorBlend), mix(vColor.a, uStrokeOpacity, colorBlend) * alpha);
  } else {
    // Extend node fill to center of stroke if no stroke
    float radius = (1.0 + vStrokePosition) / 2.0;
    if (dist > radius + vAntialiasDistance / 2.0) {
      discard;
    }
    float alpha = 1.0 - smoothstep(radius - vAntialiasDistance / 2.0, radius + vAntialiasDistance / 2.0, dist);
    outColor = vec4(vColor.rgb, vColor.a * alpha);
  }
}
