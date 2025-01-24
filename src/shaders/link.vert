#version 300 es
in vec2 aPosition;
in vec4 aOffset;

uniform mat3 uMatrix;
uniform float uWidth;

void main() {
  vec2 dir = normalize(aOffset.zw - aOffset.xy);
  vec2 normal = vec2(-dir.y, dir.x);
  vec3 pos = vec3(
    aPosition.x * aOffset.x + (1.0 - aPosition.x) * aOffset.z + (aPosition.y - 0.5) * uWidth * normal.x,
    aPosition.x * aOffset.y + (1.0 - aPosition.x) * aOffset.w + (aPosition.y - 0.5) * uWidth * normal.y,
    1.0
  );
  vec2 position = (uMatrix * pos).xy;
  gl_Position = vec4(position, 0.0, 1.0);
}
