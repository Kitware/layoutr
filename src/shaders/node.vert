#version 300 es
in vec2 aPosition;
in vec2 aOffset;
in vec4 aColor;
in float aRadius;

uniform mat3 uMatrix;
uniform float uScreenWidthPixels;
uniform float uStrokeWidth;

out vec4 vColor;
out vec2 vPosition;
out float vAntialiasDistance;
out float vStrokePosition;

void main() {
  float fullRadius = aRadius + uStrokeWidth / 2.0;
  vec2 position = aPosition * fullRadius + aOffset;
  position = (uMatrix * vec3(position, 1.0)).xy;
  vPosition = aPosition;
  gl_Position = vec4(position, 0.0, 1.0);
  vColor = aColor;

  // 1px is 2.0 / uScreenWidthPixels in GL screen space.
  // 1 unit in position space (the full radius of the dot) becomes aRadius * uMatrix[0][0] in GL screen space.
  // screen / pixel = 2 / uScreenWidthPixels
  // screen / position = aRadius * uMatrix[0][0]
  // position / screen = 1 / (aRadius * uMatrix[0][0])
  // Putting this together you get:
  // position / pixel = (position / screen) * (screen / pixel)
  //                  = (1 / (aRadius * uMatrix[0][0])) * (2 / uScreenWidthPixels)
  //                  = 2 / (aRadius * uMatrix[0][0] * uScreenWidthPixels)
  vAntialiasDistance = 2.0 / (fullRadius * uMatrix[0][0] * uScreenWidthPixels);
  vStrokePosition = (aRadius - uStrokeWidth / 2.0) / fullRadius;
}
