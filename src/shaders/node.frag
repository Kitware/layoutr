#version 300 es
precision mediump float;

in vec4 vColor;
in vec2 vPosition;

in float vAntialiasDistance;

out vec4 outColor;

void main() {
  float dist = length(vPosition);
  float radius = 1.0;
  if (dist > radius + vAntialiasDistance / 2.0) {
    discard;
  }
  float alpha = 1.0 - smoothstep(radius - vAntialiasDistance / 2.0, radius + vAntialiasDistance / 2.0, dist);
  outColor = vec4(vColor.rgb, vColor.a * alpha);
}
