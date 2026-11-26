// Thin WebGL2 helpers: compile programs with readable errors, look up uniforms once, and build
// vertex arrays and textures from plain typed arrays. No engine, no dependencies.

export function createGlContext(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 is not available in this browser');
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  return gl;
}

function compileShader(gl, type, source, label) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    const numbered = source.split('\n').map((line, i) => `${String(i + 1).padStart(3)}: ${line}`).join('\n');
    throw new Error(`${label} ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader failed:\n${log}\n${numbered}`);
  }
  return shader;
}

/** Links a program and returns it with a `u` map of every active uniform location. */
export function createProgram(gl, vertexSource, fragmentSource, label = 'program') {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource, label));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, label));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`${label} failed to link: ${gl.getProgramInfoLog(program)}`);
  const u = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    const name = info.name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(program, info.name);
  }
  return { program, u, label };
}

/**
 * Builds a vertex array from attribute arrays: { location, data, size, divisor?, usage? }.
 * Returns the VAO and its buffers so dynamic attributes can be refilled later.
 */
export function createVertexArray(gl, attributes, indices = null) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffers = {};
  for (const attribute of attributes) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, attribute.data, attribute.usage ?? gl.STATIC_DRAW);
    gl.enableVertexAttribArray(attribute.location);
    gl.vertexAttribPointer(attribute.location, attribute.size, gl.FLOAT, false, 0, 0);
    if (attribute.divisor) gl.vertexAttribDivisor(attribute.location, attribute.divisor);
    buffers[attribute.name ?? attribute.location] = buffer;
  }
  let indexBuffer = null;
  if (indices) {
    indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  }
  gl.bindVertexArray(null);
  return { vao, buffers, indexBuffer, indexType: indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
}

/** Replaces the contents of one dynamic attribute buffer. */
export function refillBuffer(gl, buffer, data) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
}

/** A texture from a canvas or image, mipmapped and repeating unless told otherwise. */
export function createTextureFromCanvas(gl, canvas, { repeat = true, mipmaps = true } = {}) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  if (aniso && mipmaps) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  return texture;
}

/** A single-channel float texture (the heightfield the water shader reads for depth). */
export function createHeightTexture(gl, heights, side) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, side, side, 0, gl.RED, gl.FLOAT, heights);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  return texture;
}

/** Sets the shared atmosphere uniforms (sun, sky, fog, camera, time) on any program that has them. */
export function setAtmosphereUniforms(gl, p, frame) {
  const { atmosphere: a, camera } = frame;
  if (p.u.uViewProj) gl.uniformMatrix4fv(p.u.uViewProj, false, camera.viewProj);
  if (p.u.uCameraPos) gl.uniform3fv(p.u.uCameraPos, camera.position);
  if (p.u.uSunDir) gl.uniform3fv(p.u.uSunDir, a.sunDirection);
  if (p.u.uSunColor) gl.uniform3fv(p.u.uSunColor, a.sunColor);
  if (p.u.uSkyAmbient) gl.uniform3fv(p.u.uSkyAmbient, a.skyAmbient);
  if (p.u.uGroundAmbient) gl.uniform3fv(p.u.uGroundAmbient, a.groundAmbient);
  if (p.u.uZenithColor) gl.uniform3fv(p.u.uZenithColor, a.zenithColor);
  if (p.u.uHorizonColor) gl.uniform3fv(p.u.uHorizonColor, a.horizonColor);
  if (p.u.uFogColor) gl.uniform3fv(p.u.uFogColor, a.fogColor);
  if (p.u.uFogDensity) gl.uniform1f(p.u.uFogDensity, a.fogDensity);
  if (p.u.uFogFalloff) gl.uniform1f(p.u.uFogFalloff, a.fogFalloff);
  if (p.u.uNight) gl.uniform1f(p.u.uNight, a.night);
  if (p.u.uExposure) gl.uniform1f(p.u.uExposure, a.exposure);
  if (p.u.uTime) gl.uniform1f(p.u.uTime, frame.time);
  if (p.u.uLandingLight) gl.uniform4fv(p.u.uLandingLight, frame.landingLight);
  if (p.u.uLandingDir) gl.uniform3fv(p.u.uLandingDir, frame.landingDirection);
  if (p.u.uTerrainLight && frame.terrainLight) {
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, frame.terrainLight.texture);
    gl.uniform1i(p.u.uTerrainLight, 3);
    gl.uniform2f(p.u.uTerrainMap, frame.terrainLight.half, frame.terrainLight.size);
    gl.activeTexture(gl.TEXTURE0);
  }
  if (p.u.uUseTerrainLight) gl.uniform1f(p.u.uUseTerrainLight, frame.terrainLight ? 1 : 0);
}
