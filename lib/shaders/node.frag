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
  if(uStrokeOpacity > 0.0f && uStrokeWidth > 0.0f) {
    float radius = 1.0f;
    if(dist > radius + vAntialiasDistance / 2.0f) {
      discard;
    }
    float alpha = 1.0f - smoothstep(radius - vAntialiasDistance / 2.0f, radius + vAntialiasDistance / 2.0f, dist);
    float colorBlend = smoothstep(vStrokePosition - vAntialiasDistance / 2.0f, vStrokePosition + vAntialiasDistance / 2.0f, dist);
    outColor = vec4(mix(vColor.rgb, vec3(0.0f), colorBlend), mix(vColor.a, uStrokeOpacity, colorBlend) * alpha);
  } else {
    // Extend node fill to center of stroke if no stroke
    float radius = (1.0f + vStrokePosition) / 2.0f;
    if(dist > radius + vAntialiasDistance / 2.0f) {
      discard;
    }
    float alpha = 1.0f - smoothstep(radius - vAntialiasDistance / 2.0f, radius + vAntialiasDistance / 2.0f, dist);
    outColor = vec4(vColor.rgb, vColor.a * alpha);
  }
}
