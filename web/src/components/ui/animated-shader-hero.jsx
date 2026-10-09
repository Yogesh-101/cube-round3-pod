import React, { useRef, useEffect } from 'react';

// Reusable Shader Background Hook
const useShaderBackground = () => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef();
  const rendererRef = useRef(null);
  const pointersRef = useRef(null);

  class WebGLRenderer {
    constructor(canvas, scale) {
      this.canvas = canvas;
      this.scale = scale;
      this.gl = canvas.getContext('webgl2');
      if (!this.gl) return;
      this.gl.viewport(0, 0, canvas.width * scale, canvas.height * scale);
      this.shaderSource = defaultShaderSource;
      this.program = null;
      this.vs = null;
      this.fs = null;
      this.buffer = null;
      this.mouseMove = [0, 0];
      this.mouseCoords = [0, 0];
      this.pointerCoords = [0, 0];
      this.nbrOfPointers = 0;
      this.vertexSrc = `#version 300 es
precision highp float;
in vec4 position;
void main(){gl_Position=position;}`;
      this.vertices = [-1, 1, -1, -1, 1, 1, 1, -1];
    }

    updateShader(source) { this.reset(); this.shaderSource = source; this.setup(); this.init(); }
    updateMove(d) { this.mouseMove = d; }
    updateMouse(c) { this.mouseCoords = c; }
    updatePointerCoords(c) { this.pointerCoords = c; }
    updatePointerCount(n) { this.nbrOfPointers = n; }
    updateScale(s) { this.scale = s; if (this.gl) this.gl.viewport(0, 0, this.canvas.width * s, this.canvas.height * s); }

    compile(shader, source) {
      const gl = this.gl;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(shader));
    }

    test(source) {
      const gl = this.gl;
      const shader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      const result = gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? null : gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      return result;
    }

    reset() {
      const gl = this.gl;
      if (!gl) return;
      if (this.program && !gl.getProgramParameter(this.program, gl.DELETE_STATUS)) {
        if (this.vs) { gl.detachShader(this.program, this.vs); gl.deleteShader(this.vs); }
        if (this.fs) { gl.detachShader(this.program, this.fs); gl.deleteShader(this.fs); }
        gl.deleteProgram(this.program);
      }
    }

    setup() {
      const gl = this.gl;
      if (!gl) return;
      this.vs = gl.createShader(gl.VERTEX_SHADER);
      this.fs = gl.createShader(gl.FRAGMENT_SHADER);
      this.compile(this.vs, this.vertexSrc);
      this.compile(this.fs, this.shaderSource);
      this.program = gl.createProgram();
      gl.attachShader(this.program, this.vs);
      gl.attachShader(this.program, this.fs);
      gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(this.program));
    }

    init() {
      const gl = this.gl;
      if (!gl || !this.program) return;
      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(this.program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      this.program.resolution = gl.getUniformLocation(this.program, 'resolution');
      this.program.time = gl.getUniformLocation(this.program, 'time');
      this.program.move = gl.getUniformLocation(this.program, 'move');
      this.program.touch = gl.getUniformLocation(this.program, 'touch');
      this.program.pointerCount = gl.getUniformLocation(this.program, 'pointerCount');
      this.program.pointers = gl.getUniformLocation(this.program, 'pointers');
    }

    render(now = 0) {
      const gl = this.gl;
      const p = this.program;
      if (!gl || !p || gl.getProgramParameter(p, gl.DELETE_STATUS)) return;
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(p);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.uniform2f(p.resolution, this.canvas.width, this.canvas.height);
      gl.uniform1f(p.time, now * 1e-3);
      gl.uniform2f(p.move, ...this.mouseMove);
      gl.uniform2f(p.touch, ...this.mouseCoords);
      gl.uniform1i(p.pointerCount, this.nbrOfPointers);
      gl.uniform2fv(p.pointers, this.pointerCoords);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  class PointerHandler {
    constructor(element, scale) {
      this.scale = scale;
      this.active = false;
      this.pointers = new Map();
      this.lastCoords = [0, 0];
      this.moves = [0, 0];
      const map = (el, s, x, y) => [x * s, el.height - y * s];
      element.addEventListener('pointerdown', (e) => { this.active = true; this.pointers.set(e.pointerId, map(element, this.scale, e.clientX, e.clientY)); });
      element.addEventListener('pointerup', (e) => { if (this.count === 1) this.lastCoords = this.first; this.pointers.delete(e.pointerId); this.active = this.pointers.size > 0; });
      element.addEventListener('pointerleave', (e) => { if (this.count === 1) this.lastCoords = this.first; this.pointers.delete(e.pointerId); this.active = this.pointers.size > 0; });
      element.addEventListener('pointermove', (e) => { if (!this.active) return; this.lastCoords = [e.clientX, e.clientY]; this.pointers.set(e.pointerId, map(element, this.scale, e.clientX, e.clientY)); this.moves = [this.moves[0] + e.movementX, this.moves[1] + e.movementY]; });
    }
    get count() { return this.pointers.size; }
    get move() { return this.moves; }
    get coords() { return this.pointers.size > 0 ? Array.from(this.pointers.values()).flat() : [0, 0]; }
    get first() { return this.pointers.values().next().value || this.lastCoords; }
  }

  const resize = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = Math.max(1, 0.5 * window.devicePixelRatio);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    if (rendererRef.current) rendererRef.current.updateScale(dpr);
  };

  const loop = (now) => {
    if (!rendererRef.current || !pointersRef.current) return;
    rendererRef.current.updateMouse(pointersRef.current.first);
    rendererRef.current.updatePointerCount(pointersRef.current.count);
    rendererRef.current.updatePointerCoords(pointersRef.current.coords);
    rendererRef.current.updateMove(pointersRef.current.move);
    rendererRef.current.render(now);
    animationFrameRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = Math.max(1, 0.5 * window.devicePixelRatio);
    rendererRef.current = new WebGLRenderer(canvas, dpr);
    pointersRef.current = new PointerHandler(canvas, dpr);
    rendererRef.current.setup();
    rendererRef.current.init();
    resize();
    if (rendererRef.current.test(defaultShaderSource) === null) rendererRef.current.updateShader(defaultShaderSource);
    loop(0);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (rendererRef.current) rendererRef.current.reset();
    };
  }, []);

  return canvasRef;
};

// ── Keyframe injection ──────────────────────────────────────────────
const STYLE_ID = 'hero-shader-keyframes';
const injectKeyframes = () => {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    @keyframes _heroFadeDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }
    @keyframes _heroFadeUp   { from { opacity:0; transform:translateY(30px);  } to { opacity:1; transform:translateY(0); } }
    ._heroFadeDown { animation: _heroFadeDown 0.8s ease-out forwards; }
    ._heroFadeUp   { animation: _heroFadeUp   0.8s ease-out forwards; opacity:0; }
    ._delay200 { animation-delay:.2s; }
    ._delay400 { animation-delay:.4s; }
    ._delay600 { animation-delay:.6s; }
    ._delay800 { animation-delay:.8s; }
  `;
  document.head.appendChild(el);
};

// ── Hero Component ──────────────────────────────────────────────────
const Hero = ({ trustBadge, headline, subtitle, buttons, style }) => {
  const canvasRef = useShaderBackground();
  useEffect(() => { injectKeyframes(); }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', background: '#020617', ...style }}>
      {/* WebGL shader canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', opacity: 0.55 }}
      />

      {/* Dark overlay gradient */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 0%, #020617 80%)' }} />

      {/* Content */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px', textAlign: 'center'
      }}>

        {/* Trust badge */}
        {trustBadge && (
          <div className="_heroFadeDown" style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '8px 20px', background: 'rgba(59,130,246,0.1)',
              backdropFilter: 'blur(8px)', border: '1px solid rgba(96,165,250,0.3)',
              borderRadius: '999px', fontSize: '0.85rem', color: '#bfdbfe'
            }}>
              {trustBadge.icons?.map((icon, i) => <span key={i}>{icon}</span>)}
              <span>{trustBadge.text}</span>
            </div>
          </div>
        )}

        {/* Headline */}
        <div style={{ marginBottom: '24px' }}>
          <h1 className="_heroFadeUp _delay200" style={{
            fontSize: 'clamp(2.8rem, 8vw, 6rem)', fontWeight: 800, margin: '0 0 8px 0',
            lineHeight: 1.1, letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #93c5fd 0%, #38bdf8 50%, #818cf8 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
          }}>
            {headline.line1}
          </h1>
          <h1 className="_heroFadeUp _delay400" style={{
            fontSize: 'clamp(2.8rem, 8vw, 6rem)', fontWeight: 800, margin: 0,
            lineHeight: 1.1, letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #38bdf8 0%, #60a5fa 50%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
          }}>
            {headline.line2}
          </h1>
        </div>

        {/* Subtitle */}
        <p className="_heroFadeUp _delay600" style={{
          maxWidth: '680px', fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
          color: 'rgba(186,230,253,0.85)', lineHeight: 1.7, margin: '0 0 40px 0', fontWeight: 300
        }}>
          {subtitle}
        </p>

        {/* Buttons */}
        {buttons && (
          <div className="_heroFadeUp _delay800" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {buttons.primary && (
              <button
                onClick={buttons.primary.onClick}
                style={{
                  padding: '14px 32px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                  color: '#fff', border: 'none', borderRadius: '999px',
                  fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 8px 24px -4px rgba(59,130,246,0.5)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 12px 30px -4px rgba(59,130,246,0.7)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(59,130,246,0.5)'; }}
              >
                {buttons.primary.text}
              </button>
            )}
            {buttons.secondary && (
              <button
                onClick={buttons.secondary.onClick}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '14px 32px', background: 'rgba(59,130,246,0.1)',
                  color: '#bfdbfe', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '999px',
                  fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                  backdropFilter: 'blur(8px)', transition: 'all 0.2s'
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.borderColor = 'rgba(96,165,250,0.6)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; e.currentTarget.style.borderColor = 'rgba(96,165,250,0.3)'; }}
              >
                {buttons.secondary.icon}
                {buttons.secondary.text}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom fade to bg */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '160px', background: 'linear-gradient(to bottom, transparent, #020617)', zIndex: 5 }} />
    </div>
  );
};

// ── GLSL Shader ─────────────────────────────────────────────────────
const defaultShaderSource = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 resolution;
uniform float time;
#define FC gl_FragCoord.xy
#define T time
#define R resolution
#define MN min(R.x,R.y)
float rnd(vec2 p) {
  p=fract(p*vec2(12.9898,78.233));
  p+=dot(p,p+34.56);
  return fract(p.x*p.y);
}
float noise(in vec2 p) {
  vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
  float a=rnd(i),b=rnd(i+vec2(1,0)),c=rnd(i+vec2(0,1)),d=rnd(i+1.);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p) {
  float t=.0,a=1.;mat2 m=mat2(1.,-.5,.2,1.2);
  for(int i=0;i<5;i++){t+=a*noise(p);p*=2.*m;a*=.5;}
  return t;
}
float clouds(vec2 p) {
  float d=1.,t=.0;
  for(float i=.0;i<3.;i++){float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);t=mix(t,d,a);d=a;p*=2./(i+1.);}
  return t;
}
void main(void) {
  vec2 uv=(FC-.5*R)/MN,st=uv*vec2(2,1);
  vec3 col=vec3(0);
  float bg=clouds(vec2(st.x+T*.5,-st.y));
  uv*=1.-.3*(sin(T*.2)*.5+.5);
  for(float i=1.;i<12.;i++){
    uv+=.1*cos(i*vec2(.1+.01*i,.8)+i*i+T*.5+.1*uv.x);
    vec2 p=uv;
    float d=length(p);
    col+=.00125/d*(cos(sin(i)*vec3(1,2,3))+1.);
    float b=noise(i+p+bg*1.731);
    col+=.002*b/length(max(p,vec2(b*p.x*.02,p.y)));
    col=mix(col,vec3(bg*.05,bg*.137,bg*.45),d);
  }
  O=vec4(col,1);
}`;

export default Hero;
