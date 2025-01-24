#version 300 es
precision mediump float;

uniform float uOpacity;

out vec4 outColor;

void main() {
  outColor = vec4(0.0, 0.0, 0.0, uOpacity);
}
