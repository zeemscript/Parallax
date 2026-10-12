import { useEffect, useRef } from 'react';
import { useReducedMotion } from './motion';

/**
 * MoltenMetal — flowing liquid-metal background.
 *
 * Domain-warped fbm noise shaded with a metallic ramp, rendered on a full-bleed
 * WebGL canvas. Falls back to a static CSS gradient when WebGL is unavailable
 * or the user asks for reduced motion, so the section is never blank.
 */

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform vec3  u_a;
uniform vec3  u_b;
uniform vec3  u_c;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = p * 2.02 + vec2(3.1, 1.7);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p  = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  float t = u_time * 0.055;

  // Two rounds of domain warping give the slow, viscous flow.
  vec2 q = vec2(fbm(p * 1.6 + vec2(0.0, t)), fbm(p * 1.6 + vec2(4.3, -t)));
  vec2 r = vec2(fbm(p * 1.9 + 3.4 * q + vec2(1.7, 9.2) + 0.15 * t),
                fbm(p * 1.9 + 3.4 * q + vec2(8.3, 2.8) - 0.12 * t));
  float f = fbm(p * 1.7 + 3.0 * r);

  // Metallic ramp: sharpened bands read as specular sheen on liquid.
  float sheen = pow(abs(sin(f * 7.0 + t * 1.6)), 6.0);
  vec3 col = mix(u_a, u_b, clamp(f * 1.5, 0.0, 1.0));
  col = mix(col, u_c, clamp(length(r) * 0.9, 0.0, 1.0));
  col += sheen * 0.5;

  // Vignette so the type on top always keeps contrast.
  float vig = smoothstep(1.25, 0.25, length(uv - 0.5) * 1.6);
  col *= vig;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function MoltenMetal({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (prefersReducedMotion) return;

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');

    // Palette is read from the live theme so the background follows light/dark.
    const readPalette = () => {
      const cs = getComputedStyle(document.documentElement);
      const hex = (name: string, fallback: [number, number, number]) => {
        const v = cs.getPropertyValue(name).trim();
        const m = /^#([\da-f]{6})$/i.exec(v);
        if (!m) return fallback;
        const n = parseInt(m[1], 16);
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] as [number, number, number];
      };
      gl.uniform3fv(gl.getUniformLocation(prog, 'u_a'), hex('--metal-a', [0.05, 0.04, 0.09]));
      gl.uniform3fv(gl.getUniformLocation(prog, 'u_b'), hex('--metal-b', [0.34, 0.19, 0.62]));
      gl.uniform3fv(gl.getUniformLocation(prog, 'u_c'), hex('--metal-c', [0.66, 0.33, 0.97]));
    };
    readPalette();

    const themeWatch = new MutationObserver(readPalette);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    let raf = 0;
    let running = true;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);

    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    const start = performance.now();
    const frame = () => {
      if (!running) return;
      resize();
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    frame();

    // Stop drawing when the section is off-screen or the tab is hidden.
    const io = new IntersectionObserver(([e]) => {
      running = e.isIntersecting && !document.hidden;
      if (running) frame(); else cancelAnimationFrame(raf);
    }, { threshold: 0 });
    io.observe(canvas);

    const onVis = () => {
      running = !document.hidden;
      if (running) frame(); else cancelAnimationFrame(raf);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      themeWatch.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [prefersReducedMotion]);

  return <canvas ref={ref} className={`bit-metal ${className}`} aria-hidden="true" />;
}
