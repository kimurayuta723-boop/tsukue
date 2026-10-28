/* つくえ: desk, papers, light and lens */
(() => {
const $ = s => document.querySelector(s);
const layer = $('#layer'), mat = $('#mat'), hand = $('#hand');
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const dur = ms => RM.matches ? Math.min(ms, 120) : ms;
const DAY = 864e5, KEY = 'tsukue-v1', WD = '日月火水木金土';
let W = innerWidth, H = innerHeight;
const S = { memos: [], sinkDays: 7, offset: 0, z: 0, no: 0, lastType: 'memo', lastColor: 'y' };
const now = () => Date.now() + S.offset;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => Math.random().toString(36).slice(2, 10);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const p2 = n => String(n).padStart(2, '0');

/* ---------- storage ---------- */
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
let saveT; function dirty() { clearTimeout(saveT); saveT = setTimeout(save, 300); }
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && Array.isArray(d.memos)) { Object.assign(S, d); return true; } } catch (e) {}
  return false;
}

/* ---------- textures ---------- */
let noiseCanvas = null;
function noiseTile() {
  if (noiseCanvas) return noiseCanvas;
  const n = document.createElement('canvas'); n.width = n.height = 128;
  const x = n.getContext('2d'), d = x.createImageData(128, 128), r = rng(11);
  for (let i = 0; i < 128 * 128; i++) { const v = r() * 255; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 13; }
  x.putImageData(d, 0, 0); return (noiseCanvas = n);
}
function makeFilm() {
  const n = document.createElement('canvas'); n.width = n.height = 150;
  const x = n.getContext('2d'), d = x.createImageData(150, 150), r = rng(41);
  for (let i = 0; i < 150 * 150; i++) { const v = 128 + (r() + r() + r() - 1.5) * 14; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
  x.putImageData(d, 0, 0);
  try { document.documentElement.style.setProperty('--film', `url(${n.toDataURL()})`); } catch (e) {}
}
function makeGrain() {
  const n = document.createElement('canvas'); n.width = n.height = 180;
  const x = n.getContext('2d'), r = rng(23), d = x.createImageData(180, 180);
  for (let i = 0; i < 180 * 180; i++) { const v = 150 + r() * 105; d.data[i * 4] = v; d.data[i * 4 + 1] = v; d.data[i * 4 + 2] = v - 6; d.data[i * 4 + 3] = r() < .5 ? 14 : 4; }
  x.putImageData(d, 0, 0);
  x.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const px = r() * 180, py = r() * 180, a = r() * Math.PI, l = 3 + r() * 9;
    x.strokeStyle = `rgba(120,110,90,${.05 + r() * .07})`; x.lineWidth = .6;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * .5 + r() * 2, py + Math.sin(a) * l * .5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  try { document.documentElement.style.setProperty('--grain', `url(${n.toDataURL()})`); } catch (e) {}
}
/* Wood desk rendered as a fragment shader: each plank is a flat-sawn slice of a log,
   so growth rings form cathedral arches where the cut passes near the pith. */
const WOOD_VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const WOOD_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uDpr; uniform float uDark; uniform float uBoard; uniform float uSeed; uniform vec3 uL; uniform vec3 uView; uniform vec3 uLC; uniform float uLamp; uniform vec3 uLp; uniform float uDay;
float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(h12(i),h12(i+vec2(1.,0.)),u.x),mix(h12(i+vec2(0.,1.)),h12(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(17.1,9.3);a*=.5;}return s;}
/* boards are never laid perfectly straight: each seam wanders and tilts a little */
float seamD(float k,float x,float W){return (vn(vec2(x*.004,k*7.31+uSeed))-.5)*2.6+(vn(vec2(x*.03,k*3.7))-.5)*.5+(x/W-.5)*(h12(vec2(k,uSeed+21.))-.5)*5.;}
void main(){
  vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uDpr;
  float W=uRes.x/uDpr, Hh=uRes.y/uDpr;
  float off=uBoard*(.2+.6*h12(vec2(uSeed,2.)));
  float bw=uBoard*(.85+.3*h12(vec2(uSeed,4.)));
  float py=p.y+off;
  float k=floor(py/bw);
  float y0=k*bw+seamD(k,p.x,W), y1=(k+1.)*bw+seamD(k+1.,p.x,W);
  if(py<y0){ y1=y0; k-=1.; y0=k*bw+seamD(k,p.x,W); }
  else if(py>y1){ y0=y1; k+=1.; y1=(k+1.)*bw+seamD(k+1.,p.x,W); }
  float bi=k, yy=py-y0, bh=y1-y0;

  /* butt joint: some boards are two pieces */
  float jx=W*(.15+.7*h12(vec2(bi,uSeed+1.)));
  float hasJ=step(.45,h12(vec2(bi,uSeed+2.)));
  float jxe=jx+(yy/bh-.5)*(h12(vec2(bi,uSeed+30.))-.5)*3.+(vn(vec2(yy*.15,bi*5.))-.5)*.9;
  float piece=bi*2.+hasJ*step(jxe,p.x);
  float r1=h12(vec2(piece,uSeed+3.)),r2=h12(vec2(piece,uSeed+4.)),r3=h12(vec2(piece,uSeed+5.)),r4=h12(vec2(piece,uSeed+6.));
  float u=p.x+r1*3000.;

  /* where the plank sat in the log */
  float pith=uBoard*(.5+(r2-.5)*1.7);
  float depth=uBoard*(.28+r3*1.1)+uBoard*.22*sin(u*(.0018+.002*r4)+r1*6.)+fbm(vec2(u*.0012,r2*9.))*uBoard*.7;
  float y=yy-pith+(fbm(vec2(u*.004,yy*.025+r3*5.))-.5)*14.+(fbm(vec2(u*.0009,yy*.008+r4*5.))-.5)*34.;

  /* knot: rings flow around it */
  vec2 kc=vec2(W*(.1+.8*h12(vec2(piece,uSeed+7.))),uBoard*(.28+.44*h12(vec2(piece,uSeed+8.))));
  float hasK=step(.6,h12(vec2(piece,uSeed+9.)));
  float ks=6.+8.*h12(vec2(piece,uSeed+10.));
  vec2 kd=vec2(p.x-kc.x,yy-kc.y);
  float kf=hasK*exp(-(kd.x*kd.x)/(ks*ks*24.)-(kd.y*kd.y)/(ks*ks*5.));
  y+=sign(kd.y+.001)*kf*ks*2.4;

  float rr=sqrt(y*y+depth*depth);
  float ringW=3.+2.8*r4;
  float rings=rr/(ringW*(.75+.5*fbm(vec2(rr*.02,r2*3.))))+fbm(vec2(u*.008,yy*.06))*.5;
  float t=fract(rings);
  float late=smoothstep(.42,.95,t)*(1.-smoothstep(.95,1.,t));
  late*=(.35+.75*fbm(vec2(u*.003,floor(rings)*.71)))*.72;

  vec3 E=mix(vec3(.86,.70,.51),vec3(.43,.285,.185),uDark);
  vec3 L=mix(vec3(.59,.395,.22),vec3(.205,.12,.075),uDark);
  float tint=(r1-.5)*.16;
  E*=1.+tint; L*=1.+tint*.8;
  vec3 col=mix(E,L,late);
  col*=1.+(fbm(p*.0025+r2*7.)-.5)*.2;
  float r5=h12(vec2(piece,uSeed+11.)),r6=h12(vec2(piece,uSeed+12.)),r7=h12(vec2(piece,uSeed+13.)),r8=h12(vec2(piece,uSeed+14.));
  /* board-to-board variety: some boards redder, some greyer, some more saturated */
  col*=mix(vec3(1.06,.98,.91),vec3(.94,.98,1.04),r5);
  float lum=dot(col,vec3(.3,.59,.11)); col=mix(vec3(lum),col,.75+.5*r6);
  /* pale sapwood along one edge of some boards */
  if(r7<.3){ float sy=bh*(r8<.5?.1:.9), sw=bh*(.12+.12*r6);
    float sm=1.-smoothstep(sw*.35,sw,abs(yy-sy+(vn(vec2(u*.008,r8*9.))-.5)*16.));
    col=mix(col,col*vec3(1.13,1.1,1.0)+.03,sm*.65); }
  /* grey mineral streak */
  if(r8>.72){ float my=bh*(.2+.6*r7)+(fbm(vec2(u*.004,r6*7.))-.5)*bh*.45, mw=1.2+3.5*r5;
    float mm=exp(-pow((yy-my)/mw,2.))*smoothstep(.3,.7,fbm(vec2(u*.003,r7*5.)));
    col=mix(col,col*vec3(.7,.7,.75),mm*.55); }
  /* wavy figure on a few boards */
  if(r6>.82){ col*=1.+sin(u*.32+fbm(vec2(u*.01,yy*.05))*9.)*.035; }
  /* fine scratches from years of use, at a few angles */
  float scr=0.;
  for(int i=0;i<3;i++){ float a=h12(vec2(float(i),uSeed+40.))*3.1416; vec2 dr=vec2(cos(a),sin(a));
    vec2 q2=vec2(dot(p,dr),dot(p,vec2(-dr.y,dr.x)));
    scr+=smoothstep(.935,.99,vn(q2*vec2(.012,1.5)+float(i)*13.))*smoothstep(.58,.82,vn(q2*vec2(.004,.02)+float(i)*7.)); }
  scr=min(scr,1.);
  col=mix(col,col*1.06+.015,scr*.45);
  /* a faint cup ring someone left long ago */
  vec2 cc=vec2(W*(.15+.7*h12(vec2(uSeed,50.))),Hh*(.2+.6*h12(vec2(uSeed,51.))));
  float crd=16.+10.*h12(vec2(uSeed,52.)), hasC=step(.4,h12(vec2(uSeed,53.)));
  vec2 dv=p-cc; vec2 dn=dv/max(length(dv),.001);
  float dist=length(dv)-crd-(vn(dn*2.3+uSeed)-.5)*2.6;
  float ring=hasC*exp(-dist*dist/1.4)*(.45+.55*vn(dn*3.1+uSeed+3.));
  col*=1.-ring*.15-hasC*(1.-smoothstep(-2.,0.,dist))*.035;

  /* fibres, open pores, ray flecks */
  col*=1.+(vn(vec2(u*.03,yy*1.8))-.5)*.10+(vn(vec2(u*.008,yy*3.2))-.5)*.08;
  col*=1.+(vn(vec2(u*.011,yy*.6))-.5)*.06;
  float pore=smoothstep(.8,.93,vn(vec2(u*.42,yy*4.8)))*(1.-late*.6);
  col*=1.-pore*.18;
  float ray=smoothstep(.87,.96,vn(vec2(u*.055,yy*1.05)+r3*20.));
  col=mix(col,col*1.07+.02,ray*.55*(1.-uDark*.4));

  /* knot core */
  float kr=length(vec2(kd.x*.55,kd.y));
  float km=hasK*(1.-smoothstep(ks*.5,ks,kr));
  vec3 kcol=mix(L*.55,L*.85,smoothstep(.25,.9,fract(kr/2.)));
  col=mix(col,kcol,km);
  col=mix(col,L*.55,hasK*exp(-kr*kr/(ks*ks*.1))*.7);
  col*=1.-hasK*(1.-smoothstep(ks,ks*2.2,kr))*.06;

  /* seams between boards and at the butt joint */
  float e=min(yy,bh-yy);
  float gap=.6+1.*vn(vec2(p.x*.008,bi*3.1+uSeed));
  col*=1.-(1.-smoothstep(.45*gap,1.5*gap,e))*(.45+.25*vn(vec2(p.x*.02,bi)));
  col*=1.-(1.-smoothstep(1.5,8.,e))*.07;
  col+=smoothstep(1.3,1.9,yy)*(1.-smoothstep(1.9,3.,yy))*.05;
  float jd=mix(1e4,abs(p.x-jxe),hasJ);
  col*=1.-(1.-smoothstep(.4,1.3,jd))*.55;
  col+=step(jxe+.6,p.x)*(1.-smoothstep(1.3,2.4,jd))*.04*hasJ;

  /* lighting: the same light the papers use. Relief comes from latewood, pores and the board bevels */
  float hb=(vn(vec2(u*.02,yy*1.2))-.5)*.5+(vn(vec2(u*.006,yy*.35))-.5)*.8-(1.-smoothstep(.4,3.5,e))*2.2-(1.-smoothstep(.3,2.5,jd))*1.8;
  vec3 N=vec3(0.,0.,1.);
#ifdef BUMP
  vec2 g=clamp(vec2(-dFdx(hb),dFdy(hb))*uDpr*.45,-.6,.6);
  N=normalize(vec3(g,1.));
#endif
  vec3 P=vec3(p,0.); vec3 V=normalize(uView-P);
  /* daylight through the window, fading to dim blue sky light at dusk */
  vec3 Lv=uL-P; vec3 Ln=normalize(Lv);
  float lam=clamp(dot(N,Ln)/max(Ln.z,.08),.55,1.5);
  vec3 sunLit=(1.08-.1*length(p)/length(vec2(W,Hh)))*mix(1.,lam,.9)*uLC;
  vec3 sky=vec3(.277,.294,.344);
  vec3 lit=mix(sky,sunLit,uDay);
  /* the desk lamp, coming on as the room darkens */
  vec3 Lv2=uLp-P; vec3 Ln2=normalize(Lv2);
  float lam2=clamp(dot(N,Ln2)/max(Ln2.z,.08),.55,1.5);
  float I=pow(uLp.z*uLp.z/(uLp.z*uLp.z+dot(Lv2.xy,Lv2.xy)),1.5);
  vec3 lampC=mix(vec3(.66,.70,.82),vec3(1.,.80,.56),clamp(I*1.7,0.,1.));
  lit+=uLamp*((.42+I*lam2)*lampC-sky);
  col*=lit;
  float sm=(1.-pore*.85)*(1.-late*.35)*(1.-ring*.6);
  float h1=max(dot(N,normalize(Ln+V)),0.), h2=max(dot(N,normalize(Ln2+V)),0.);
  float sp1=(pow(h1,70.)*.26+pow(h1,9.)*.05)*sm+scr*pow(h1,4.)*.18;
  float sp2=(pow(h2,70.)*.26+pow(h2,9.)*.05)*sm+scr*pow(h2,4.)*.18;
  col+=sp1*uLC*.6*uDay+sp2*lampC*(1.7*I+.04)*uLamp;
  col+=(h12(gl_FragCoord.xy)-.5)*(2./255.);
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;
let gl = null, woodProg = null, glTried = false;
function initWood() {
  glTried = true;
  try { gl = mat.getContext('webgl', { antialias: false, preserveDrawingBuffer: true, alpha: false }); } catch (e) { gl = null; }
  if (!gl) return;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  try {
    const pr = gl.createProgram();
    const bump = gl.getExtension('OES_standard_derivatives') ? '#extension GL_OES_standard_derivatives : enable\n#define BUMP 1\n' : '';
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, WOOD_VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, bump + WOOD_FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    woodProg = pr;
  } catch (e) { woodProg = null; }
}
function isDark() {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
}
mat.addEventListener('webglcontextlost', e => { e.preventDefault(); woodProg = null; });
mat.addEventListener('webglcontextrestored', () => { glTried = false; gl = null; drawMat(); });
function drawMat() {
  computeLight();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  mat.width = Math.round(W * dpr); mat.height = Math.round(H * dpr);
  if (!glTried) initWood();
  if (gl && woodProg) {
    gl.viewport(0, 0, mat.width, mat.height);
    const U = n => gl.getUniformLocation(woodProg, n);
    gl.uniform2f(U('uRes'), mat.width, mat.height);
    gl.uniform1f(U('uDpr'), dpr);
    gl.uniform1f(U('uDark'), isDark() ? 1 : 0);
    gl.uniform1f(U('uLamp'), L.wl);
    gl.uniform1f(U('uDay'), L.D);
    gl.uniform3f(U('uLp'), L.lampL.x, L.lampL.y, L.lampL.z);
    gl.uniform1f(U('uBoard'), clamp(W * .42, 140, 210));
    gl.uniform1f(U('uSeed'), S.woodSeed || 3);
    gl.uniform3f(U('uL'), L.sunL.x, L.sunL.y, L.sunL.z);
    const lc = L.sunL.lc || [1, .99, .965], lb = L.sunL.bright || 1;
    gl.uniform3f(U('uLC'), lc[0] * lb, lc[1] * lb, lc[2] * lb);
    gl.uniform3f(U('uView'), W / 2, H / 2, Math.max(W, H) * 1.5);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    lightAll();
    return;
  }
  lightAll();
  if (!gl) drawMat2D(); else { gl.clearColor(isDark() ? .35 : .78, isDark() ? .24 : .61, isDark() ? .16 : .43, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
}
function drawMat2D() {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(W * dpr), h = Math.round(H * dpr);
  mat.width = w; mat.height = h;
  const c = mat.getContext('2d'), cs = getComputedStyle(document.documentElement);
  const base = cs.getPropertyValue('--desk').trim() || '#9dad9f', deep = cs.getPropertyValue('--desk-deep').trim() || '#7f927f';
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  const r = rng(7);
  // boards run left to right; each board is cut from a different part of the log
  const ph = Math.round(Math.max(150, Math.min(240, W * .5)) * dpr);
  for (let top = -Math.round(ph * .35); top < h; top += ph) {
    c.save();
    c.beginPath(); c.rect(0, top, w, ph); c.clip();
    // board tone
    c.globalAlpha = .10 + r() * .16;
    c.fillStyle = r() < .55 ? deep : '#fff3dc'; c.fillRect(0, top, w, ph);
    // long soft streaks
    for (let i = 0; i < 6; i++) {
      const y = top + r() * ph, hh = (8 + r() * 40) * dpr, g = c.createLinearGradient(0, y - hh, 0, y + hh);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, r() < .6 ? deep : '#ffeccc'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = .08 + r() * .1; c.fillStyle = g; c.fillRect(0, y - hh, w, hh * 2);
    }
    // knot (not on every board)
    const knot = r() < .55 ? { x: r() * w, y: top + ph * (.3 + r() * .4), s: (14 + r() * 22) * dpr } : null;
    // grain lines
    const n = 46 + Math.floor(r() * 20), ph1 = r() * 6, f1 = (.0016 + r() * .0016) / dpr, f2 = (.006 + r() * .006) / dpr;
    for (let j = 0; j < n; j++) {
      const y0 = top + (j / n) * ph + r() * 4 * dpr, amp = (2 + r() * 7) * dpr, amp2 = r() * 1.6 * dpr, ph2 = r() * 6;
      c.beginPath();
      for (let x = -10; x <= w + 10; x += 6 * dpr) {
        let y = y0 + Math.sin(x * f1 + ph1 + j * .05) * amp + Math.sin(x * f2 + ph2) * amp2;
        if (knot) {
          const dx = x - knot.x, dy = y0 - knot.y, s = knot.s * 3.2;
          const bend = Math.exp(-(dx * dx) / (s * s * 1.6)) * Math.exp(-(dy * dy) / (s * s * .9));
          y += Math.sign(dy || 1) * bend * knot.s * 1.3;
        }
        x < 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      const dark = r() < .78;
      c.globalAlpha = dark ? .05 + r() * .14 : .05 + r() * .08;
      c.strokeStyle = dark ? '#2a1606' : '#fff6e4';
      c.lineWidth = (.5 + r() * (r() < .15 ? 2.6 : 1.1)) * dpr;
      c.stroke();
    }
    if (knot) {
      for (let k = 6; k > 0; k--) {
        c.beginPath(); c.ellipse(knot.x, knot.y, knot.s * k / 4.2, knot.s * k / 9, 0, 0, Math.PI * 2);
        c.globalAlpha = .06 + (6 - k) * .025; c.strokeStyle = '#2a1606'; c.lineWidth = dpr * (k < 2 ? 2 : 1); c.stroke();
      }
      c.beginPath(); c.ellipse(knot.x, knot.y, knot.s / 4, knot.s / 9, 0, 0, Math.PI * 2);
      c.globalAlpha = .35; c.fillStyle = '#2a1606'; c.fill();
    }
    c.restore();
    // seam between boards
    c.globalAlpha = .45; c.fillStyle = '#1c0e04'; c.fillRect(0, top + ph - dpr, w, dpr);
    c.globalAlpha = .18; c.fillStyle = '#fff1d6'; c.fillRect(0, top + ph, w, dpr);
    c.globalAlpha = .10; c.fillStyle = '#1c0e04'; c.fillRect(0, top + ph - 4 * dpr, w, 3 * dpr);
    // end joint somewhere along long boards
    if (r() < .6) {
      const jx = Math.round(r() * w);
      c.globalAlpha = .4; c.fillStyle = '#1c0e04'; c.fillRect(jx, top, dpr, ph);
      c.globalAlpha = .15; c.fillStyle = '#fff1d6'; c.fillRect(jx + dpr, top, dpr, ph);
    }
  }
  // satin finish: fine pores and a soft sheen
  c.globalAlpha = 1; c.fillStyle = c.createPattern(noiseTile(), 'repeat'); c.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 1800; i++) {
    c.globalAlpha = .12 + r() * .12; c.fillStyle = '#2a1606';
    c.fillRect(r() * w, r() * h, dpr * (1 + r() * 3), dpr * .8);
  }
  const sheen = c.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, 'rgba(255,248,232,.10)'); sheen.addColorStop(.45, 'rgba(255,248,232,0)'); sheen.addColorStop(1, 'rgba(40,20,6,.08)');
  c.globalAlpha = 1; c.fillStyle = sheen; c.fillRect(0, 0, w, h);
}

/* ---------- paper geometry ---------- */
const RATIO = { memo: [.96, 1.04], sticky: [.86, .86], receipt: [.66, 1.3], note: [1, 1.24] };
const base = () => Math.min(W * .41, 215);
const dims = (type, b = base()) => [RATIO[type][0] * b, RATIO[type][1] * b];
function zoomDims(type) {
  let [w, h] = dims(type, Math.min(W - 48, 370));
  const max = Math.max(240, H * .5);
  if (h > max) { const k = max / h; w *= k; h *= k; }
  return [w, h];
}
// every sheet gets slightly irregular edges: cut paper is never a perfect rectangle
function printVals(m) {
  const r = rng((m.seed * 3 + 1) | 0);
  const skew = (r() - .5) * 1.3, pr = (r() - .5) * 1.1, ir = (r() - .5) * 2.2;
  return { skew, pr, ir: m.type === 'note' ? skew : ir };
}
function clipFor(m) {
  const r = rng(m.seed);
  const P = { memo: [.35, .5], sticky: [.07, .7], receipt: [.3, .7], note: [.22, .45] }[m.type];
  const amp = P[0], bow = P[1];
  const pts = [];
  const f = v => v.toFixed(2) + '%';
  // one side from (x0,y0) to (x1,y1); offsets go inward along (nx,ny)
  function side(x0, y0, x1, y1, nx, ny, n, kind) {
    const b = r() * bow, ph = r() * .6 - .3;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      let off = Math.max(0, Math.sin(Math.PI * (t + ph * t * (1 - t))) * b) + r() * amp;
      let x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (kind === 'torn') off = r() * 3.4 + Math.sin(t * 9 + ph * 10) * .5 + .5;
      if (kind === 'teeth') {
        const tooth = (i % 2 ? 1 : 0) * (.8 + r() * .9);
        x += (r() - .5) * (100 / n) * .35;
        off = tooth + r() * .25;
      }
      pts.push(f(x + nx * off) + ' ' + f(y + ny * off));
    }
  }
  const N = m.type === 'receipt' ? 18 : 10;
  side(0, 0, 100, 0, 0, 1, m.type === 'receipt' ? 22 : N, m.type === 'receipt' ? 'teeth' : '');
  side(100, 0, 100, 100, -1, 0, m.type === 'receipt' ? 16 : N, '');
  side(100, 100, 0, 100, 0, -1, m.type === 'receipt' ? 22 : N, m.type === 'receipt' ? 'teeth' : '');
  side(0, 100, 0, 0, 1, 0, m.type === 'note' ? 30 : (m.type === 'receipt' ? 16 : N), m.type === 'note' ? 'torn' : '');
  return `polygon(${pts.join(',')})`;
}

/* ---------- per-sheet paper texture: tone, mottling, fibres, creases, ruling ---------- */
const BASE = { memo: [251, 250, 245], note: [252, 252, 247], receipt: [246, 245, 241], y: [245, 223, 114], p: [243, 184, 176], m: [191, 225, 204] };
function paintTex(cv, m, cssW) {
  const R0 = RATIO[m.type], dpr = Math.min(devicePixelRatio || 1, 2);
  const TW = clamp(Math.round(cssW * dpr), 160, 760), TH = Math.round(TW * R0[1] / R0[0]);
  cv.width = TW; cv.height = TH;
  const c = cv.getContext('2d'); if (!c) return;
  const r = rng((m.seed ^ 0x5bd1e995) | 0), u = TW / 100, pv = printVals(m);
  let b = (m.type === 'sticky' ? BASE[m.color || 'y'] : BASE[m.type]).slice();
  const tone = (r() - .5) * (m.type === 'sticky' ? 16 : 7), warm = (r() - .35) * 6;
  b = [b[0] + tone + warm, b[1] + tone, b[2] + tone - warm * 1.5].map(v => clamp(Math.round(v), 0, 255));
  const rgb = (k, a) => `rgba(${b.map(v => clamp(Math.round(v * k), 0, 255)).join(',')},${a})`;
  c.fillStyle = rgb(1, 1); c.fillRect(0, 0, TW, TH);

  // mottling: uneven pulp density
  for (let i = 0; i < 28; i++) {
    const x = r() * TW, y = r() * TH, rad = (.08 + r() * .5) * TW, g = c.createRadialGradient(x, y, 0, x, y, rad);
    const k = r() < .55 ? .955 : 1.035;
    g.addColorStop(0, rgb(k, .14 + r() * .16)); g.addColorStop(1, rgb(k, 0));
    c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // the sheet is never perfectly flat: broad soft light and shade
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2, Lg = Math.max(TW, TH), cx = TW * (.3 + r() * .4), cy = TH * (.3 + r() * .4);
    const g = c.createLinearGradient(cx - Math.cos(a) * Lg / 2, cy - Math.sin(a) * Lg / 2, cx + Math.cos(a) * Lg / 2, cy + Math.sin(a) * Lg / 2);
    const st = .025 + r() * .04;
    g.addColorStop(0, `rgba(255,255,255,${st})`); g.addColorStop(.25 + r() * .5, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(70,45,20,${st * .9})`);
    c.fillStyle = g; c.fillRect(0, 0, TW, TH);
  }
  c.lineCap = 'round'; c.lineJoin = 'round';
  const sl = Math.tan(pv.skew * Math.PI / 180);

  if (m.type === 'sticky') {
    // adhesive strip: slightly darker and glossier, with an uneven lower edge
    const gy = 15 * u;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(TW, 0);
    for (let x = TW; x >= -2 * u; x -= 2.5 * u) c.lineTo(x, gy + (r() - .5) * .9 * u + Math.sin(x * .03 / u * 3) * .35 * u);
    c.closePath();
    const g = c.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, 'rgba(0,0,0,.055)'); g.addColorStop(.7, 'rgba(0,0,0,.035)'); g.addColorStop(1, 'rgba(255,255,255,.06)');
    c.fillStyle = g; c.fill();
  }
  if (m.type === 'note') {
    // printed ruling: a hair off square, ink weight drifts along each line
    const mx = 16 * u + (r() - .5) * .8 * u, top = 16 * u;
    c.lineWidth = Math.max(.8, u * .3);
    for (let y = 0; y < TH; y += 3 * u) {
      const x0 = mx - (y - top) * sl + Math.sin(y * .02 / u + 1) * .1 * u, x1 = mx - (y + 3 * u - top) * sl;
      c.strokeStyle = `rgba(214,128,124,${.5 + r() * .35})`;
      c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y + 3 * u); c.stroke();
    }
    const ph = r() * 6;
    for (let n = 1; ; n++) {
      const y0 = top + n * 9.4 * u - c.lineWidth / 2;
      if (y0 > TH - 2 * u) break;
      const fade = .5 + r() * .3, wob = .06 + r() * .1;
      for (let x = 0; x < TW; x += 4 * u) {
        const ya = y0 + x * sl + Math.sin(x / TW * 7 + ph + n) * wob * u, yb = y0 + (x + 4 * u) * sl + Math.sin((x + 4 * u) / TW * 7 + ph + n) * wob * u;
        c.strokeStyle = `rgba(150,180,214,${clamp(fade + (r() - .5) * .3, .25, .95)})`;
        c.beginPath(); c.moveTo(x, ya); c.lineTo(x + 4 * u, yb); c.stroke();
      }
    }
  }
  if (m.type === 'receipt') {
    // thermal paper: faint print-head banding and one side fading
    for (let y = 0; y < TH; y += 1 + r() * 3) { c.fillStyle = `rgba(80,80,90,${r() * .025})`; c.fillRect(0, y, TW, 1); }
    const g = c.createLinearGradient(0, 0, TW, 0), sideA = r() < .5;
    g.addColorStop(0, `rgba(120,110,90,${sideA ? .07 : 0})`); g.addColorStop(.35, 'rgba(120,110,90,0)'); g.addColorStop(.65, 'rgba(120,110,90,0)'); g.addColorStop(1, `rgba(120,110,90,${sideA ? 0 : .07})`);
    c.fillStyle = g; c.fillRect(0, 0, TW, TH);
  }
  // creases: some sheets have been folded or crumpled once; receipts nearly always
  const nc = m.type === 'receipt' ? 1 + Math.floor(r() * 3) : (r() < .42 ? 1 + (r() < .3 ? 1 : 0) : 0);
  for (let i = 0; i < nc; i++) {
    const horiz = r() < (m.type === 'receipt' ? .8 : .5);
    let ax, ay, bx, by;
    if (horiz) { ax = -2; ay = TH * (.15 + r() * .7); bx = TW + 2; by = ay + (r() - .5) * TH * .25; }
    else { ay = -2; ax = TW * (.15 + r() * .7); by = TH + 2; bx = ax + (r() - .5) * TW * .3; }
    const qx = (ax + bx) / 2 + (r() - .5) * TW * .12, qy = (ay + by) / 2 + (r() - .5) * TH * .08;
    const nx = horiz ? 0 : 1, ny = horiz ? 1 : 0, w = (.25 + r() * .3) * u;
    // soft shade on one side of the fold, highlight on the ridge
    c.lineWidth = w * 6; c.strokeStyle = `rgba(80,60,40,${.025 + r() * .025})`;
    c.beginPath(); c.moveTo(ax + nx * w * 2, ay + ny * w * 2); c.quadraticCurveTo(qx + nx * w * 2, qy + ny * w * 2, bx + nx * w * 2, by + ny * w * 2); c.stroke();
    c.lineWidth = w; c.strokeStyle = `rgba(70,50,30,${.08 + r() * .06})`;
    c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(qx, qy, bx, by); c.stroke();
    c.lineWidth = w * .9; c.strokeStyle = `rgba(255,255,255,${.25 + r() * .2})`;
    c.beginPath(); c.moveTo(ax - nx * w * 1.2, ay - ny * w * 1.2); c.quadraticCurveTo(qx - nx * w * 1.2, qy - ny * w * 1.2, bx - nx * w * 1.2, by - ny * w * 1.2); c.stroke();
  }
  // small foxing spots on a few sheets
  if (r() < .3) for (let i = 0, n = 1 + Math.floor(r() * 4); i < n; i++) {
    const x = r() * TW, y = r() * TH, rad = (.3 + r() * 1.1) * u, g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(150,105,50,${.08 + r() * .1})`); g.addColorStop(1, 'rgba(150,105,50,0)');
    c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // handled edges pick up a little grime, unevenly
  [[0, 0, TW, 0, 0, 1], [0, TH, TW, TH, 0, -1], [0, 0, 0, TH, 1, 0], [TW, 0, TW, TH, -1, 0]].forEach(([x0, y0, x1, y1, nx, ny]) => {
    const d = (1 + r() * 3) * u, g = c.createLinearGradient(x0, y0, x0 + nx * d, y0 + ny * d);
    g.addColorStop(0, `rgba(90,70,45,${.03 + r() * .05})`); g.addColorStop(1, 'rgba(90,70,45,0)');
    c.fillStyle = g; c.fillRect(Math.min(x0, x0 + nx * d), Math.min(y0, y0 + ny * d), Math.max(Math.abs(x1 - x0), d), Math.max(Math.abs(y1 - y0), d));
  });

  // fibres and grain: resolution dependent, so they use their own random stream
  const r2 = rng((m.seed * 7 + TW) | 0);
  const nf = Math.round(TW * TH / (m.type === 'receipt' ? 1100 : m.type === 'sticky' ? 800 : 420));
  for (let i = 0; i < nf; i++) {
    const x = r2() * TW, y = r2() * TH, a = r2() * Math.PI, l = (.5 + r2() * 2.6) * u;
    const light = r2() < .3;
    c.strokeStyle = light ? `rgba(255,255,255,${.18 + r2() * .25})` : `rgba(110,88,58,${.04 + r2() * .08})`;
    c.lineWidth = (.12 + r2() * .22) * u;
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x + Math.cos(a) * l * .5 + (r2() - .5) * u * .6, y + Math.sin(a) * l * .5 + (r2() - .5) * u * .6, x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
  try {
    const d = c.getImageData(0, 0, TW, TH), px = d.data, amp = m.type === 'sticky' ? 5 : 7;
    for (let i = 0; i < px.length; i += 4) { const n = (r2() - .5) * amp; px[i] += n; px[i + 1] += n; px[i + 2] += n * .9; }
    c.putImageData(d, 0, 0);
  } catch (e) {}
}
function paintSheet(container, m, cssW) {
  const cv = container.querySelector('.tex'); if (cv) paintTex(cv, m, cssW);
}
const fmtShort = t => { const d = new Date(t); return `${d.getMonth() + 1} . ${d.getDate()}`; };
const fmtRc = t => { const d = new Date(t); return `${d.getFullYear()}/${p2(d.getMonth() + 1)}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const PH = { memo: '思いついたことを書く', sticky: '忘れたくないこと', receipt: '買ったもの、控えておくこと', note: '考えごとを書く' };
function sheetHTML(m, editable) {
  const ink = editable
    ? `<textarea class="ink" id="zt" aria-label="メモの内容" placeholder="${PH[m.type]}" spellcheck="false"></textarea>`
    : `<div class="ink">${esc(m.text)}</div>`;
  let deco = '';
  if (m.type === 'memo') deco = `<div class="hd"><span>MEMO</span><span>${fmtShort(m.created)}</span></div>`;
  if (m.type === 'note') deco = `<div class="nt-hd">DATE<u>${fmtShort(m.created)}</u></div>`;
  if (m.type === 'receipt') deco = `<div class="rc-hd">＊ メ モ ＊<small>${fmtRc(m.created)}<br>No.${String(m.no).padStart(4, '0')}</small></div><div class="rc-ft">またのメモを<br>お待ちしております</div>`;
  const cp = clipFor(m), pv = printVals(m);
  return `<div class="sheet" style="clip-path:${cp};-webkit-clip-path:${cp};--ir:${pv.ir.toFixed(2)}deg;--pr:${pv.pr.toFixed(2)}deg"><canvas class="tex" aria-hidden="true"></canvas>${deco}${ink}<div class="age"></div><div class="lit"></div><div class="curl"></div></div>`;
}

/* ---------- light ---------- */
// light mode: daylight from a window beyond the top-left corner. dark mode: a desk lamp near the top-left.
let L = { x: -200, y: -400, z: 1000, size: 400, dark: false, amb: .3 };
// the window light follows the real clock: the sun crosses from left (morning) to right (evening),
// low sun throws long warm shadows, midday light is high and neutral, after dark the window gives cool skylight
let hourOverride = null, PATCH = null;
const realHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };
const hourNow = () => hourOverride ?? realHour();
const fmtH = h => { let hh = Math.floor(h), mm = Math.round((h - hh) * 60); if (mm === 60) { hh++; mm = 0; } return `${hh}:${p2(mm)}`; };
function sunState() {
  const t = hourNow();
  // D: how much daylight comes through the window. It rises over dawn and fades over dusk instead of switching
  const D = sstep(5.3, 6.9, t) * (1 - sstep(17.1, 18.9, t));
  // the lamp is switched on as the room gets dark and off once the morning is bright
  const wl = Math.max(1 - sstep(5.5, 6.7, t), sstep(17.3, 18.6, t));
  const tc = clamp(t, 6, 18), dp = (tc - 6) / 12, elev = Math.sin(Math.PI * dp);
  const warm = Math.pow(1 - elev, 2.4);
  const mix3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  // low sun turns golden, then rosy as it fades
  const lc = mix3(mix3([1, .985, .95], [1, .78, .52], warm), [1, .64, .46], (1 - D) * .7);
  return { t, D, wl, az: clamp(dp * 2 - 1, -1, 1), ang: 15 + elev * 53, elev, warm, lc };
}
function computeLight() {
  const theme = isDark(), M = Math.max(W, H), sun = sunState();
  const D = theme ? 0 : sun.D, wl = theme ? 1 : sun.wl;
  const lampL = { x: W * .2, y: H * .07, z: Math.max(320, M * .62), size: 44, dark: true, amb: .40 };
  const hx = sun.az * 1.1, hy = -1, hn = Math.hypot(hx, hy), dh = M * 4, lz = dh * Math.tan(sun.ang * Math.PI / 180);
  const sunL = { x: W / 2 + hx / hn * dh, y: H / 2 + hy / hn * dh, z: lz, size: Math.hypot(dh, lz) * .09, dark: false, amb: 1, lc: sun.lc, bright: .96 + .07 * sun.elev, warm: sun.warm * .3 };
  PATCH = null;
  if (D > .02) {
    // where the window's light lands on the desk
    const eN = clamp((sun.ang - 15) / 53, 0, 1), az = sun.az;
    const pw = W * .72, ph = H * (.3 + .18 * (1 - eN)), cx = W * (.5 - az * .26), cy = H * (.34 + .2 * (1 - eN)), sk = -az * ph * .7;
    const TL = [cx - pw / 2 - sk / 2, cy - ph / 2], TR = [cx + pw / 2 - sk / 2, cy - ph / 2], BR = [cx + pw / 2 + sk / 2, cy + ph / 2], BL = [cx - pw / 2 + sk / 2, cy + ph / 2];
    PATCH = {
      pts: [TL, TR, BR, BL], cx, cy, pw, ph, s: Math.min(W, H) / 400, D,
      at: (u, v) => [TL[0] + u * (TR[0] - TL[0]) + v * (BL[0] - TL[0]), TL[1] + u * (TR[1] - TL[1]) + v * (BL[1] - TL[1])],
      rgb: sun.lc.map((v, i) => Math.round(v * [255, 214, 154][i])), alpha: (.54 + .06 * sun.warm) * D, az
    };
  }
  // shadows follow whichever light is stronger; at the crossover both are faint, so the hand-off is soft
  L = Object.assign({}, wl > D ? lampL : sunL, { D, wl, sunL, lampL });
  const vx = W / 2 - L.x, vy = H / 2 - L.y, n = Math.hypot(vx, vy) || 1;
  const k = L.dark ? 1 : clamp(.55 / Math.tan(sun.ang * Math.PI / 180), .45, 1.5);
  document.documentElement.style.setProperty('--ux', (vx / n * k).toFixed(3));
  document.documentElement.style.setProperty('--uy', (vy / n * k).toFixed(3));
  document.querySelector('.l-glow').style.opacity = D.toFixed(3);
  document.querySelector('.l-vig').style.opacity = (1 - wl).toFixed(3);
  document.querySelector('.l-vign').style.opacity = wl.toFixed(3);
  lampGlow = wl;
  sizeAtmos(); if (RM.matches) atmosStatic();
}
let lampGlow = 0;
const intensityOf = (src, x, y) => { const z2 = src.z * src.z; return Math.pow(z2 / (z2 + (x - src.x) ** 2 + (y - src.y) ** 2), 1.5); };
const intensity = (x, y) => intensityOf(L, x, y);
// how each sheet curls off the desk: sticky notes lift along the bottom, receipts at both ends, others at a corner
const CORN = [[0, 0], [1, 0], [1, 1], [0, 1]];
const curlCache = new Map();
function curlOf(m) {
  const key = m.seed + m.type; if (curlCache.has(key)) return curlCache.get(key);
  const r = rng((m.seed * 5 + 3) | 0), c = [0, 0, 0, 0];
  let cp;
  if (m.type === 'sticky') { const a = 5 + r() * 6; c[2] = a * (.7 + r() * .3); c[3] = a * (.7 + r() * .3); cp = [50, 100]; }
  else if (m.type === 'receipt') { const a = 6 + r() * 7, top = r() < .5; c[0] = c[1] = top ? a : a * .55; c[2] = c[3] = top ? a * .55 : a; cp = [50, top ? 0 : 100]; }
  else { const k = Math.floor(r() * 4), a = 3 + r() * 6; c[k] = a; if (r() < .35) c[(k + 1) % 4] = a * .35; cp = [CORN[k][0] * 100, CORN[k][1] * 100]; }
  const v = { c, cp, max: Math.max(...c) };
  curlCache.set(key, v); return v;
}
// CSS matrix3d that maps the w x h box onto an arbitrary quad (p0..p3 = TL, TR, BR, BL)
function quadMatrix(w, h, p) {
  const [x0, y0] = p[0], [x1, y1] = p[1], [x2, y2] = p[2], [x3, y3] = p[3];
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-6;
  const g = (dx3 * dy2 - dx2 * dy3) / den, q = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + q * x3, d = y1 - y0 + g * y1, e = y3 - y0 + q * y3;
  const f = v => v.toFixed(6);
  return `matrix3d(${f(a / w)},${f(d / w)},0,${f(g / w)},${f(b / h)},${f(e / h)},0,${f(q / h)},0,0,1,0,${x0.toFixed(2)},${y0.toFixed(2)},0,1)`;
}
function lightEl(root, lift, cx, cy, h, rot, st) {
  const D = L.D ?? (L.dark ? 0 : 1), wl = L.wl ?? (L.dark ? 1 : 0);
  const Il = L.lampL ? intensityOf(L.lampL, cx, cy) : intensity(cx, cy), I = L.dark ? Il : 1;
  const sunB = (1.07 - .1 * Math.hypot(cx, cy) / Math.hypot(W, H)) * ((L.sunL || L).bright || 1);
  const bright = .40 + (sunB - .40) * D + wl * Il;
  root.style.setProperty('--shade', clamp(1 - bright, 0, .72).toFixed(3));
  root.style.setProperty('--warm', clamp(((L.sunL || L).warm || 0) * D + wl * (.18 + .32 * Il), 0, .5).toFixed(3));
  const ax = cx - L.x, ay = cy - L.y;
  root.style.setProperty('--ld', (Math.atan2(ax, -ay) * 180 / Math.PI - rot).toFixed(1) + 'deg');
  root.style.setProperty('--far', (L.dark ? .1 + .1 * I : .06).toFixed(3));
  const cr = Math.cos(rot * Math.PI / 180), sr = Math.sin(rot * Math.PI / 180);
  const toLocal = (x, y) => [x * cr + y * sr, -x * sr + y * cr];
  const col = L.dark ? '10,5,2' : '44,24,8';
  // contact shadow: tight and dark where the sheet touches the desk
  const den0 = Math.max(L.z - h, 60), k0 = Math.min(h, 1) / den0;
  const [qx, qy] = toLocal(ax * k0, ay * k0);
  const contA = (L.dark ? .35 + .5 * I : .58) * (1 - Math.min(h / 5, 1) * .92);
  // ambient occlusion: the room's diffuse light, no direction, very soft
  const ambA = (L.dark ? .1 : .16) * (1 - Math.min(h / 70, .6)), ambB = 2.5 + h * .45;
  const contact = `drop-shadow(${qx.toFixed(2)}px ${qy.toFixed(2)}px ${(.6 + h * .05).toFixed(2)}px rgba(${col},${contA.toFixed(3)}))`;
  const ambient = `drop-shadow(0px ${(ambB * .25).toFixed(2)}px ${ambB.toFixed(2)}px rgba(${col},${ambA.toFixed(3)}))`;
  root.style.setProperty('--hs', (1 + h * .0022).toFixed(4));
  const strength = clamp(L.dark ? wl * (1 - .6 * D) : D * (1 - .6 * wl), 0, 1);
  const castA = (L.dark ? .88 * (.35 + .65 * I) : .5) * (1 - Math.min(h / 90, .55)) * strength;

  if (!st || !st.shade) {
    const k = h / den0, [sx, sy] = toLocal(ax * k, ay * k);
    lift.style.filter = `${contact} drop-shadow(${sx.toFixed(2)}px ${sy.toFixed(2)}px ${(.8 + L.size * k + h * .12).toFixed(2)}px rgba(${col},${castA.toFixed(3)}))`;
    return;
  }
  lift.style.filter = `${contact} ${ambient}`;
  // cast shadow: project each corner from the light at its own height, so curled corners throw longer, softer shadow
  const m = st.m, w = st.w, hh = st.h, cu = curlOf(m), fl = 1 - .65 * Math.min(ageOf(m), 1);
  const pts = []; let ks = 0, kmin = Infinity, kmax = 0;
  for (let i = 0; i < 4; i++) {
    const lx = (CORN[i][0] - .5) * w, ly = (CORN[i][1] - .5) * hh;
    const wx = cx + lx * cr - ly * sr, wy = cy + lx * sr + ly * cr;
    const hi = h + cu.c[i] * fl, k = hi / Math.max(L.z - hi, 60);
    ks += k; kmin = Math.min(kmin, k); kmax = Math.max(kmax, k);
    const [ox, oy] = toLocal((wx - L.x) * k, (wy - L.y) * k);
    pts.push([CORN[i][0] * w + ox, CORN[i][1] * hh + oy]);
  }
  const kav = ks / 4;
  st.shade.style.transform = quadMatrix(w, hh, pts);
  // the penumbra widens with height: the light's apparent size times the gap under the sheet
  st.shade.style.filter = `blur(${(.7 + L.size * kav + h * .1).toFixed(2)}px)`;
  root.style.setProperty('--sa', castA.toFixed(3));
  root.style.setProperty('--shc', col);
  root.style.setProperty('--cpx', cu.cp[0] + '%'); root.style.setProperty('--cpy', cu.cp[1] + '%');
  // the curled part faces a little inward, so it catches the light when the light is on the far side
  const cvx = cu.cp[0] - 50, cvy = cu.cp[1] - 50, cn = Math.hypot(cvx, cvy) || 1;
  const [tlx, tly] = toLocal(-ax, -ay), tn = Math.hypot(tlx, tly) || 1;
  const sdot = (cvx * tlx + cvy * tly) / (cn * tn), amt = clamp(cu.max * fl / 9, 0, 1);
  root.style.setProperty('--cg', sdot < 0
    ? `rgba(255,252,240,${(-sdot * .2 * amt).toFixed(3)})`
    : `rgba(50,30,12,${(sdot * .16 * amt).toFixed(3)})`);
}

/* ---------- atmosphere ---------- */
const roomCv = document.getElementById('roomshade'), maskCv = document.createElement('canvas');
const sunCv = document.getElementById('sunlight'), moteCv = document.getElementById('motes'), lampEl = document.querySelector('.l-lamp');
const hsh = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const n1 = t => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return hsh(i) + (hsh(i + 1) - hsh(i)) * u; };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TREE = [], FLECKS = [], MOTES = [];
(() => {
  const r = rng(91);
  // a small tree outside the window: branches reach in from the edges, twigs fork, leaves sit along the twigs
  function grow(len, w, depth, amp) {
    const node = { len, w, da: 0, t: 0, bend: (r() - .5) * .35, f: .45 + r() * .7, p: r() * 6.28, amp, leaves: [], kids: [] };
    if (depth < 2) {
      const nk = depth === 0 ? 2 : 1 + (r() < .5 ? 1 : 0);
      for (let k = 0; k < nk; k++) {
        const kid = grow(len * (.42 + r() * .25), w * .58, depth + 1, amp * 1.7);
        kid.t = .3 + r() * .65; kid.da = (k % 2 ? -1 : 1) * (.32 + r() * .5); node.kids.push(kid);
      }
    }
    if (depth >= 1) {
      const nl = depth === 1 ? 1 + Math.floor(r() * 2) : 4 + Math.floor(r() * 4);
      for (let k = 0; k < nl; k++) node.leaves.push({
        t: Math.min(1, .4 + r() * .7), off: (r() - .5) * .03, a: (k % 2 ? -1 : 1) * (.45 + r() * .8),
        len: .04 + r() * .03, wid: .34 + r() * .16, f: 1.2 + r() * 2.4, p: r() * 6.28, al: .55 + r() * .3
      });
    }
    return node;
  }
  // just one branch reaching in from the corner, so the window light stays open
  TREE.push({ x: 1.1, y: .16 + r() * .08, ang: Math.PI - .32 - r() * .12, node: grow(.44, 6.5, 0, .014) });
  for (let i = 0; i < 34; i++) FLECKS.push(i < 22 ? { u: .5 + r() * .45, v: .05 + r() * .6, r: 3.5 + r() * 5, f: .4 + r() * 1.3, p: r() * 6.28 } : { u: .1 + r() * .8, v: .1 + r() * .8, r: 3 + r() * 4, f: .4 + r() * 1.3, p: r() * 6.28 });
  for (let i = 0; i < 54; i++) MOTES.push({ x: r(), y: r(), z: r(), ph: r() * 6.28, w: .6 + r() * 1.6, vx: (r() - .5) * .006, vy: (r() - .5) * .004 });
})();
let sprite = null;
function moteSprite() {
  if (sprite) return sprite;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,250,236,1)'); g.addColorStop(.3, 'rgba(255,244,222,.6)'); g.addColorStop(1, 'rgba(255,236,205,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32); return (sprite = c);
}
function sizeAtmos() {
  const sw = Math.ceil(W / 4), shh = Math.ceil(H / 4);
  [sunCv, roomCv, maskCv].forEach(cv => { if (cv.width !== sw || cv.height !== shh) { cv.width = sw; cv.height = shh; } });
  if (moteCv.width !== W || moteCv.height !== H) { moteCv.width = W; moteCv.height = H; }
}
// tree shadow, in the patch's own space (u across, v down) with u stretched so rotations look round
const TAS = 1.5;
function drawTree(m, P, t, gust) {
  const sc = (X, Y) => P.at(X / TAS, Y);
  const bez = (x0, y0, cx, cy, x1, y1, k) => { const q = 1 - k; return [q * q * x0 + 2 * q * k * cx + k * k * x1, q * q * y0 + 2 * q * k * cy + k * k * y1]; };
  m.strokeStyle = '#000'; m.fillStyle = '#000'; m.lineCap = 'round';
  function walk(n, x, y, ang, depth) {
    // each level sways on top of its parent: the bough slowly, twigs more, leaves flutter
    const sway = (Math.sin(t * n.f + n.p) * gust + Math.sin(t * .21 + n.p) * .35) * n.amp * (depth ? 1 : 1.4);
    const a = ang + n.da + sway, ex = x + Math.cos(a) * n.len, ey = y + Math.sin(a) * n.len;
    const cx = (x + ex) / 2 + Math.cos(a + 1.571) * n.bend * n.len, cy = (y + ey) / 2 + Math.sin(a + 1.571) * n.bend * n.len;
    // taper: draw the limb in two halves, thinning toward the tip
    const [mx, my] = bez(x, y, cx, cy, ex, ey, .5);
    const [hx, hy] = bez(x, y, cx, cy, ex, ey, .25), [jx, jy] = bez(x, y, cx, cy, ex, ey, .75);
    m.globalAlpha = .74 - depth * .08;
    [[x, y, hx, hy, mx, my, n.w], [mx, my, jx, jy, ex, ey, n.w * .62]].forEach(([ax, ay, qx, qy, bx, by, w]) => {
      const A = sc(ax, ay), Q = sc(qx, qy), B = sc(bx, by);
      m.lineWidth = Math.max(.8, w * P.s); m.beginPath(); m.moveTo(A[0], A[1]); m.quadraticCurveTo(Q[0] * 2 - (A[0] + B[0]) / 2, Q[1] * 2 - (A[1] + B[1]) / 2, B[0], B[1]); m.stroke();
    });
    for (const lf of n.leaves) {
      const [px, py] = bez(x, y, cx, cy, ex, ey, lf.t);
      const la = a + lf.a + Math.sin(t * lf.f + lf.p) * .28 * (.4 + gust);
      const ux = Math.cos(la), uy = Math.sin(la), vx = -uy, vy = ux, L2 = lf.len, Wd = lf.len * lf.wid;
      const bx = px + vx * lf.off, by = py + vy * lf.off;              // leaf base on the twig
      const tx = bx + ux * L2 * 2, ty = by + uy * L2 * 2;                 // tip
      const p0 = sc(bx, by), p1 = sc(bx + ux * L2 + vx * Wd * 1.6, by + uy * L2 + vy * Wd * 1.6), p2 = sc(tx, ty), p3 = sc(bx + ux * L2 - vx * Wd * 1.6, by + uy * L2 - vy * Wd * 1.6);
      m.globalAlpha = lf.al; m.beginPath(); m.moveTo(p0[0], p0[1]);
      m.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); m.quadraticCurveTo(p3[0], p3[1], p0[0], p0[1]); m.fill();
    }
    for (const k of n.kids) { const [kx, ky] = bez(x, y, cx, cy, ex, ey, k.t); walk(k, kx, ky, a, depth + 1); }
  }
  for (const b of TREE) walk(b.node, b.x * TAS, b.y, b.ang, 0);
}
// the window patch is drawn at quarter resolution; scaling it up gives the soft edges real window light has
function drawSun(t, sunF) {
  const c = sunCv.getContext('2d'), rc = roomCv.getContext('2d'), m = maskCv.getContext('2d'); if (!c || !rc || !m) return;
  [c, rc, m].forEach(x => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, sunCv.width, sunCv.height); });
  const P = PATCH; if (!P) return;
  // 1. light mask: the window opening, minus the window frame and the leaves outside
  m.setTransform(.25, 0, 0, .25, 0, 0); m.save();
  m.beginPath(); P.pts.forEach(([x, y], i) => i ? m.lineTo(x, y) : m.moveTo(x, y)); m.closePath(); m.clip();
  m.fillStyle = '#fff'; m.fillRect(0, 0, W, H);
  const gust = .35 + .65 * n1(t / 7 + 3);
  m.globalCompositeOperation = 'destination-out'; m.fillStyle = '#000';
  drawTree(m, P, t, gust);
  m.globalAlpha = .85; m.strokeStyle = '#000';
  let [x0, y0] = P.at(.5, 0), [x1, y1] = P.at(.5, 1);
  m.lineWidth = P.pw * .028; m.beginPath(); m.moveTo(x0, y0); m.lineTo(x1, y1); m.stroke();
  [x0, y0] = P.at(0, .5); [x1, y1] = P.at(1, .5);
  m.lineWidth = P.ph * .035; m.beginPath(); m.moveTo(x0, y0); m.lineTo(x1, y1); m.stroke();
  m.restore();
  // 2. the light itself, tinted by the sun's colour
  const [r, g, b] = P.rgb;
  c.globalAlpha = P.alpha * sunF; c.drawImage(maskCv, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-in'; c.fillStyle = `rgb(${r},${g},${b})`; c.fillRect(0, 0, sunCv.width, sunCv.height);
  // komorebi: gaps between leaves throw little images of the sun that flicker as the leaves move
  c.globalCompositeOperation = 'source-over'; c.setTransform(.25, 0, 0, .25, 0, 0);
  const ang = Math.atan2(P.at(0, 1)[1] - P.at(0, 0)[1], P.at(0, 1)[0] - P.at(0, 0)[0]);
  for (const f of FLECKS) {
    const tw = Math.pow(.5 + .5 * Math.sin(t * f.f + f.p), 2.5) * (.45 + .55 * gust);
    if (tw < .04) continue;
    const [x, y] = P.at(f.u + Math.sin(t * .6 + f.p) * .01 * gust, f.v);
    c.globalAlpha = tw * .75 * sunF * P.D; c.beginPath();
    c.ellipse(x, y, f.r * P.s * 1.5, f.r * P.s, ang, 0, 6.283); c.fill();
  }
  // 3. the rest of the room sits in shade; the contrast fades when a cloud covers the sun
  rc.fillStyle = `rgba(96,92,104,${(.28 * sunF * P.D).toFixed(3)})`; rc.fillRect(0, 0, roomCv.width, roomCv.height);
  rc.globalCompositeOperation = 'destination-out'; rc.drawImage(maskCv, 0, 0);
}
// dust drifting through the beam (or under the lamp); near motes are large and out of focus
function drawMotes(t, dt, sunF) {
  const c = moteCv.getContext('2d'); if (!c) return;
  c.clearRect(0, 0, W, H);
  if (!L.dark && !PATCH) return;
  const spr = moteSprite(), k = dt / 16, wind = (n1(t / 9 + 7) - .5) * .0004;
  for (const m of MOTES) {
    m.x += ((m.vx + Math.sin(t * .23 + m.ph) * .002) * .05 + wind) * k;
    m.y += ((m.vy + Math.cos(t * .19 + m.ph) * .0015) * .05 - .00006) * k;
    m.x -= Math.floor(m.x); m.y -= Math.floor(m.y);
    const x = m.x * W, y = m.y * H;
    let lit;
    if (L.dark) { const d = Math.hypot(x - L.x, y - L.y) / (Math.min(W, H) * .8); lit = Math.max(0, 1 - d); lit *= lit * L.wl; }
    else {
      // inside the shaft of light running from the window (above the screen) down to the patch
      const top = P_TOP(), dx = x - (top + (PATCH.cx - top) * clamp(y / PATCH.cy, 0, 1.3));
      lit = Math.max(0, 1 - Math.abs(dx) / (PATCH.pw * .5)) * sstep(PATCH.cy + PATCH.ph * .6, PATCH.cy - PATCH.ph * .2, y) * sunF * PATCH.D;
    }
    if (lit < .02) continue;
    const tw = .35 + .65 * Math.pow(Math.sin(t * m.w + m.ph), 2);
    const near = m.z > .82, size = near ? 6 + m.z * 9 : 1 + m.z * 2.4;
    c.globalAlpha = lit * tw * (near ? .16 : .7);
    c.drawImage(spr, x - size, y - size, size * 2, size * 2);
  }
  c.globalAlpha = 1;
}
const P_TOP = () => PATCH.cx + PATCH.az * W * .45;
let atmosRaf = 0, atmosLast = 0, sunSet = -1;
function atmos(ts) {
  atmosRaf = 0;
  if (document.hidden) return;
  if (ts - atmosLast < 33) { atmosRaf = requestAnimationFrame(atmos); return; }
  const dt = Math.min(100, ts - (atmosLast || ts - 16)); atmosLast = ts;
  const t = ts / 1000;
  // clouds drift past every minute or two; only daylight through the window is affected
  let sunF = 1;
  if (PATCH) { const n = n1(t / 41) * .7 + n1(t / 13 + 40) * .3; sunF = 1 - .4 * sstep(.7, .92, n); }
  if (Math.abs(sunF - sunSet) > .004) { sunSet = sunF; document.documentElement.style.setProperty('--sun', sunF.toFixed(3)); }
  // an incandescent bulb never sits perfectly still
  lampEl.style.opacity = (lampGlow * (.9 + .1 * (n1(t * .5) * .75 + n1(t * 2.1 + 9) * .25))).toFixed(3);
  drawSun(t, sunF); drawMotes(t, dt, sunF);
  atmosRaf = requestAnimationFrame(atmos);
}
function startAtmos() { if (RM.matches) { atmosStatic(); return; } if (!atmosRaf) atmosRaf = requestAnimationFrame(atmos); }
function atmosStatic() { sizeAtmos(); drawSun(0, 1); const c = moteCv.getContext('2d'); if (c) c.clearRect(0, 0, W, H); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) { atmosLast = 0; startAtmos(); } });

/* ---------- elements ---------- */
const els = new Map();
const ageOf = m => clamp((now() - m.touched) / (S.sinkDays * DAY), 0, 1.15);
const restH = m => 3.2 - Math.min(ageOf(m), 1) * 2.6;   // fresh sheets curl up a little, old ones lie flat
function makeEl(m) {
  const root = document.createElement('div');
  root.tabIndex = 0; root.setAttribute('role', 'button');
  const st = { m, root, lift: null, vx: 0, vy: 0, vr: 0, moving: false, tilt: 0, w: 0, h: 0, hgt: restH(m), hv: 0, hT: restH(m), hAnim: false, hWait: 0 };
  els.set(m.id, st);
  fillEl(st);
  layer.appendChild(root);
  root.addEventListener('pointerdown', e => onPaperDown(e, st));
  root.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(st); } });
  sizeEl(st); place(st); ageEl(st);
  return st;
}
function fillEl(st) {
  const m = st.m;
  st.root.className = `paper t-${m.type} c-${m.color || 'y'}`;
  const cp = clipFor(m);
  st.root.innerHTML = `<div class="shade"><i style="clip-path:${cp};-webkit-clip-path:${cp}"></i></div><div class="lift">${sheetHTML(m, false)}</div>`;
  st.shade = st.root.firstChild;
  st.lift = st.root.lastChild;
  paintSheet(st.root, m, dims(m.type)[0]);
  st.root.setAttribute('aria-label', `${(m.text.split('\n')[0] || '白紙').slice(0, 24)}(開く)`);
}
function sizeEl(st) {
  const [w, h] = dims(st.m.type); st.w = w; st.h = h;
  st.root.style.width = w + 'px'; st.root.style.height = h + 'px';
  st.root.style.setProperty('--u', (w / 100) + 'px');
}
function place(st) {
  const m = st.m, rot = m.rot + st.tilt;
  st.root.style.transform = `translate3d(${m.x * W - st.w / 2}px,${m.y * H - st.h / 2}px,0) rotate(${rot}deg)`;
  st.root.style.zIndex = m.z;
  lightEl(st.root, st.lift, m.x * W, m.y * H, st.hgt, rot, st);
}
const ageEl = st => st.root.style.setProperty('--age', ageOf(st.m).toFixed(3));
function ageAll() {
  els.forEach(st => {
    ageEl(st);
    if (!st.hAnim && !(drag && drag.st === st)) { st.hgt = st.hT = restH(st.m); place(st); }
  });
}
function lightAll() {
  els.forEach(place);
  // the memo pad sits on the same desk, so it gets the same light
  const pad = document.getElementById('pad'); if (!pad) return;
  const r = pad.getBoundingClientRect(), I = intensityOf(L.lampL || L, r.left + r.width / 2, r.top + r.height / 2), D = L.D ?? 1;
  const b = clamp(D + (1 - D) * (.5 + (L.wl ?? 0) * I), .55, 1.05);
  pad.style.filter = D > .995 ? '' : `brightness(${b.toFixed(3)}) sepia(${((1 - D) * (.12 + .2 * I)).toFixed(2)})`;
}
const touch = (m, frac) => { m.touched = Math.max(m.touched, now() - frac * S.sinkDays * DAY); };
function raise(st, target) { st.hT = target; st.hAnim = true; kick(); }
function drop(st, delay = 0) {
  st.hT = restH(st.m);
  if (RM.matches) { st.hgt = st.hT; place(st); return; }
  st.hgt = 42; st.hv = 0; st.hWait = performance.now() + delay; st.hAnim = true; place(st);
  if (delay) st.root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay, fill: 'backwards' });
  kick();
}
function puff(st) {
  const cx = st.m.x * W, cy = st.m.y * H, R = base() * .75;
  els.forEach(o => {
    if (o === st) return;
    const dx = o.m.x * W - cx, dy = o.m.y * H - cy, d = Math.hypot(dx, dy);
    if (d > R || d < 1) return;
    const f = (1 - d / R) * .16;
    o.vx += dx / d * f; o.vy += dy / d * f; o.vr += (Math.random() - .5) * .02; o.moving = true;
  });
  setTimeout(kick, dur(300));
}
function landing(st) { raise(st, restH(st.m)); }

/* ---------- physics ---------- */
let raf = 0, last = 0;
function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } }
function step(t) {
  const dt = Math.min(34, t - last); last = t;
  const f = Math.pow(.9, dt / 16), fr = Math.pow(.86, dt / 16);
  let any = false;
  els.forEach(st => {
    let changed = false;
    if (st.moving && !(drag && drag.st === st)) {
      const m = st.m, mx = st.w * .3, my = st.h * .3;
      let px = m.x * W + st.vx * dt, py = m.y * H + st.vy * dt;
      if (px < mx) { px = mx; st.vx = Math.abs(st.vx) * .35; }
      if (px > W - mx) { px = W - mx; st.vx = -Math.abs(st.vx) * .35; }
      if (py < my) { py = my; st.vy = Math.abs(st.vy) * .35; }
      if (py > H - my) { py = H - my; st.vy = -Math.abs(st.vy) * .35; }
      m.x = px / W; m.y = py / H; m.rot = ((m.rot + st.vr * dt + 540) % 360) - 180;
      st.vx *= f; st.vy *= f; st.vr *= fr;
      changed = true;
      if (Math.hypot(st.vx, st.vy) < .004 && Math.abs(st.vr) < .002) { st.moving = false; st.vx = st.vy = st.vr = 0; dirty(); }
      else any = true;
    }
    if (st.hAnim) {
      if (t >= st.hWait) {
        // fixed 4 ms substeps keep the spring stable even when frames drop
        const rest = restH(st.m);
        for (let left = dt; left > 0; left -= 4) {
          const h4 = Math.min(4, left), falling = st.hT < st.hgt, kk = falling ? .0015 : .0011, c = falling ? .05 : .066;
          st.hv += ((st.hT - st.hgt) * kk - st.hv * c) * h4;
          st.hgt += st.hv * h4;
          if (st.hT <= rest + .01 && st.hgt < rest) { st.hgt = rest; st.hv = st.hv < -.015 ? -st.hv * .25 : 0; }
        }
        if (!isFinite(st.hgt)) { st.hgt = st.hT; st.hv = 0; }
        if (Math.abs(st.hT - st.hgt) < .04 && Math.abs(st.hv) < .002) { st.hgt = st.hT; st.hv = 0; st.hAnim = false; }
        changed = true;
      }
      if (st.hAnim) any = true;
    }
    if (changed) place(st);
  });
  raf = any ? requestAnimationFrame(step) : 0;
}

/* ---------- drag a paper ---------- */
let drag = null, sweep = null;
const binEl = $('#bin'), binTip = $('#binTip');
function binCenter() { const r = binEl.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
function onPaperDown(e, st) {
  if (drag || sweep || Z) return;
  e.preventDefault(); e.stopPropagation();
  st.moving = false; st.vx = st.vy = st.vr = 0;
  const t = performance.now();
  drag = { st, id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: st.m.x * W, oy: st.m.y * H, t0: t, moved: false, over: false, samples: [[e.clientX, e.clientY, t]] };
  st.m.z = ++S.z; st.root.style.zIndex = st.m.z;
  addEventListener('pointermove', onPaperMove);
  addEventListener('pointerup', onPaperUp);
  addEventListener('pointercancel', onPaperUp);
}
function onPaperMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const st = drag.st, dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (!drag.moved && Math.hypot(dx, dy) > 6) {
    drag.moved = true; st.root.classList.add('held'); touch(st.m, .25); ageEl(st); document.body.classList.add('lifting');
    $('#air').appendChild(st.root); binEl.classList.add('armed'); raise(st, 26);
  }
  if (!drag.moved) return;
  const t = performance.now();
  drag.samples.push([e.clientX, e.clientY, t]);
  while (drag.samples.length > 2 && t - drag.samples[0][2] > 90) drag.samples.shift();
  const s0 = drag.samples[0], vx = (e.clientX - s0[0]) / Math.max(1, t - s0[2]);
  st.tilt += (clamp(vx * 9, -9, 9) - st.tilt) * .25;
  const bc = binCenter(), over = Math.hypot(e.clientX - bc.x, e.clientY - bc.y) < 80;
  if (over !== drag.over) {
    drag.over = over;
    binEl.classList.toggle('ready', over); binTip.classList.toggle('on', over);
    raise(st, over ? 46 : 26); st.root.classList.toggle('over', over);
  }
  let cx = drag.ox + dx, cy = drag.oy + dy;
  if (over) { cx += (bc.x - cx) * .55; cy += (bc.y - cy) * .55; }   // the bin pulls the sheet over its mouth
  st.m.x = cx / W; st.m.y = cy / H; place(st);
}
function endDragUI() { binEl.classList.remove('armed', 'ready'); binTip.classList.remove('on'); document.body.classList.remove('lifting'); }
function onPaperUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag, st = d.st; drag = null;
  removeEventListener('pointermove', onPaperMove);
  removeEventListener('pointerup', onPaperUp);
  removeEventListener('pointercancel', onPaperUp);
  if (!d.moved) { if (e.type === 'pointerup' && performance.now() - d.t0 < 500) openEdit(st); return; }
  st.root.classList.remove('held');
  endDragUI();
  if (d.over && e.type === 'pointerup') { trashFromDesk(st); return; }
  st.root.classList.remove('over');
  layer.appendChild(st.root);
  const t = performance.now(), s0 = d.samples[0], sl = d.samples[d.samples.length - 1];
  let vx = (sl[0] - s0[0]) / Math.max(16, sl[2] - s0[2]), vy = (sl[1] - s0[1]) / Math.max(16, sl[2] - s0[2]);
  if (t - sl[2] > 80) vx = vy = 0;
  const sp = Math.hypot(vx, vy), cap = 2.2;
  if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
  st.m.rot += st.tilt; st.tilt = 0;
  st.vx = vx; st.vy = vy; st.vr = clamp(vx * .05, -.12, .12);
  st.moving = true; landing(st); dirty();
}
// crumple the sheet where it is and let it fall into the bin
function trashFromDesk(st) {
  const m = st.m, bc = binCenter(), fx = m.x * W, fy = m.y * H, rot = m.rot + st.tilt;
  st.hAnim = false;
  const sheet = st.lift.querySelector('.sheet');
  ['clipPath', 'webkitClipPath', 'mask', 'webkitMask'].forEach(p => { sheet.style[p] = 'none'; });
  const cr = document.createElement('div'); cr.className = 'crease'; sheet.appendChild(cr);
  const hs = (1 + st.hgt * .0022) * .46, D = dur(560);
  if (st.shade) st.shade.animate({ opacity: 0 }, { duration: D * .35, fill: 'forwards' });
  st.lift.style.filter = `drop-shadow(${(L.dark ? 6 : 4)}px ${(L.dark ? 9 : 7)}px 6px rgba(${L.dark ? '12,6,2' : '58,34,14'},.35))`;
  st.root.animate([{ translate: '0px 0px' }, { translate: `${bc.x - fx}px ${bc.y - fy}px`, offset: .45 }, { translate: `${bc.x - fx}px ${bc.y - fy}px` }], { duration: D, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' });
  sheet.animate([{ borderRadius: '0%' }, { borderRadius: '24%', offset: .3 }, { borderRadius: '50%', offset: .6 }, { borderRadius: '50%' }], { duration: D, fill: 'forwards' });
  cr.animate([{ opacity: 0 }, { opacity: 1, offset: .5 }, { opacity: 1 }], { duration: D, fill: 'forwards' });
  const a = st.lift.animate([
    { transform: `scale(${hs})` },
    { transform: `scale(${hs * .94},${hs * .84}) rotate(-6deg)`, offset: .18 },
    { transform: 'scale(.34) rotate(150deg)', offset: .5 },
    { transform: 'scale(.24) rotate(250deg)', offset: .78, opacity: 1 },
    { transform: 'scale(.07) rotate(330deg)', opacity: .6 }
  ], { duration: D, easing: 'cubic-bezier(.4,0,.4,1)', fill: 'forwards' });
  a.onfinish = () => {
    m.trashed = true; m.trashedAt = now();
    st.root.remove(); els.delete(m.id);
    renderBin(true); save();
  };
}

/* ---------- sweep the desk ---------- */
layer.addEventListener('pointerdown', e => {
  if (e.target !== layer || drag || Z) return;
  e.preventDefault();
  try { layer.setPointerCapture(e.pointerId); } catch (_) {}
  sweep = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  hand.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; hand.classList.add('on');
});
layer.addEventListener('pointermove', e => {
  if (!sweep || e.pointerId !== sweep.id) return;
  const t = performance.now(), dt = Math.max(8, t - sweep.t);
  const pvx = clamp((e.clientX - sweep.x) / dt, -3, 3), pvy = clamp((e.clientY - sweep.y) / dt, -3, 3);
  sweep.x = e.clientX; sweep.y = e.clientY; sweep.t = t;
  hand.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
  const list = [...els.values()];
  if (!list.length) return;
  let zmin = Infinity, zmax = -Infinity;
  list.forEach(s => { zmin = Math.min(zmin, s.m.z); zmax = Math.max(zmax, s.m.z); });
  const R = base() * .6;
  list.forEach(st => {
    const reach = R + Math.min(st.w, st.h) * .45;
    let dx = st.m.x * W - e.clientX, dy = st.m.y * H - e.clientY;
    const d = Math.hypot(dx, dy);
    if (d > reach) return;
    const fall = 1 - d / reach, rank = (st.m.z - zmin) / ((zmax - zmin) || 1), wgt = .2 + .8 * rank * rank;
    if (d < 1) { dx = pvx; dy = pvy; }
    const n = Math.hypot(dx, dy) || 1;
    const tvx = pvx + dx / n * .35, tvy = pvy + dy / n * .35, k = .32 * fall * wgt;
    st.vx += (tvx - st.vx) * k; st.vy += (tvy - st.vy) * k;
    st.vr += ((dx * pvy - dy * pvx) / n) * .0012 * fall * wgt;
    st.vr = clamp(st.vr, -.25, .25);
    st.moving = true;
  });
  kick();
});
const endSweep = e => { if (!sweep || e.pointerId !== sweep.id) return; sweep = null; hand.classList.remove('on'); };
layer.addEventListener('pointerup', endSweep);
layer.addEventListener('pointercancel', endSweep);

/* ---------- holding a paper (zoom) ---------- */
const zoom = $('#zoom'), slot = $('#slot'), chips = $('#chips');
let Z = null, pendingLayout = false;
function mountZoom(m) {
  const [w, h] = zoomDims(m.type);
  slot.style.width = w + 'px'; slot.style.height = h + 'px';
  slot.innerHTML = `<div class="paper zp t-${m.type} c-${m.color || 'y'}" style="--u:${w / 100}px;--age:0"><div class="lift">${sheetHTML(m, true)}</div></div>`;
  const zt = $('#zt'); zt.value = m.text;
  paintSheet(slot, m, w);
  const r = slot.getBoundingClientRect();
  lightEl(slot.firstChild, slot.firstChild.firstChild, r.left + w / 2, r.top + h / 2, 60, 0);
  return { w, h, el: slot.firstChild, zt };
}
function xform(o, r, w) {
  const dx = o.cx - (r.left + r.width / 2), dy = o.cy - (r.top + r.height / 2);
  return `translate(${dx}px,${dy}px) rotate(${o.rot}deg) scale(${o.w / w})`;
}
function updateChips() {
  chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(Z && c.dataset.type === Z.m.type)));
  $('#swSticky').className = `sw sw-sticky c-${(Z && Z.m.color) || S.lastColor}`;
}
function openZoom(origin, mode) {
  zoom.hidden = false;
  chips.hidden = mode !== 'new';
  $('#zdel').hidden = mode === 'new';
  $('#zok').textContent = mode === 'new' ? '机に置く' : '机に戻す';
  updateChips();
  Z.z = mountZoom(Z.m);
  if (origin.st) origin.st.root.style.visibility = 'hidden';
  const r = slot.getBoundingClientRect();
  Z.z.el.animate([{ transform: xform(origin, r, Z.z.w) }, { transform: 'none' }], { duration: dur(400), easing: 'cubic-bezier(.2,.85,.25,1)' });
  requestAnimationFrame(() => zoom.classList.add('on'));
  if (mode === 'new') setTimeout(() => { try { Z && Z.z.zt.focus({ preventScroll: true }); } catch (_) {} }, dur(400));
}
function openEdit(st) {
  if (Z) return;
  Z = { mode: 'edit', st, m: st.m };
  openZoom({ cx: st.m.x * W, cy: st.m.y * H, w: st.w, rot: st.m.rot, st }, 'edit');
}
function finishZoom() {
  zoom.hidden = true; zoom.classList.remove('on'); slot.innerHTML = ''; Z = null;
  if (pendingLayout) { pendingLayout = false; layout(); }
}
function flyTo(o, done) {
  try { document.activeElement && document.activeElement.blur(); } catch (_) {}
  const z = Z.z, r = slot.getBoundingClientRect();
  zoom.classList.remove('on');
  const a = z.el.animate([{ transform: 'none' }, { transform: xform(o, r, z.w) }], { duration: dur(360), easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
  a.onfinish = () => { finishZoom(); done && done(); };
}
function padOrigin() { const pr = $('#pad').getBoundingClientRect(); return { cx: pr.left + pr.width / 2, cy: pr.top + pr.height / 2, w: pr.width * .8, rot: 0 }; }

function confirmZoom() {
  if (!Z) return;
  const text = Z.z.zt.value.replace(/\s+$/, '');
  if (Z.mode === 'new') {
    if (!text.trim()) { flyTo(padOrigin()); return; }
    const m = Z.m; m.text = text; m.created = m.touched = now(); m.z = ++S.z;
    S.memos.push(m);
    const st = makeEl(m); st.root.style.visibility = 'hidden';
    flyTo({ cx: m.x * W, cy: m.y * H, w: st.w, rot: m.rot }, () => { st.root.style.visibility = ''; drop(st); puff(st); });
    save(); return;
  }
  if (!text.trim()) { trashZoom(); return; }
  const { st, m } = Z;
  m.text = text; m.touched = now(); m.z = ++S.z;
  fillEl(st); ageEl(st); place(st);
  flyTo({ cx: m.x * W, cy: m.y * H, w: st.w, rot: m.rot }, () => { st.root.style.visibility = ''; st.hgt = 22; landing(st); });
  save();
}
function trashZoom() {
  if (!Z) return;
  const { m, st, z } = Z;
  try { document.activeElement && document.activeElement.blur(); } catch (_) {}
  const sheet = z.el.querySelector('.sheet');
  sheet.style.clipPath = 'none'; sheet.style.webkitClipPath = 'none';
  const cr = document.createElement('div'); cr.className = 'crease'; sheet.appendChild(cr);
  const br = $('#bin').getBoundingClientRect(), r = slot.getBoundingClientRect();
  const dx = br.left + br.width / 2 - (r.left + r.width / 2), dy = br.top + br.height / 2 - (r.top + r.height / 2);
  zoom.classList.remove('on');
  const D = dur(760);
  sheet.animate([{ borderRadius: '0%' }, { borderRadius: '22%', offset: .3 }, { borderRadius: '50%' }], { duration: D * .6, fill: 'forwards' });
  cr.animate([{ opacity: 0 }, { opacity: 1 }], { duration: D * .45, fill: 'forwards' });
  const a = z.el.animate([
    { transform: 'none' },
    { transform: 'scale(.93,.85) rotate(-5deg)', offset: .16 },
    { transform: 'scale(.36) rotate(150deg)', offset: .46 },
    { transform: `translate(${dx * .7}px,${dy - 90}px) scale(.17) rotate(260deg)`, offset: .76 },
    { transform: `translate(${dx}px,${dy}px) scale(.09) rotate(330deg)` }
  ], { duration: D, easing: 'cubic-bezier(.4,0,.35,1)', fill: 'forwards' });
  a.onfinish = () => {
    m.trashed = true; m.trashedAt = now();
    if (st) { st.root.remove(); els.delete(m.id); }
    finishZoom(); renderBin(true); save();
  };
}
$('#zok').addEventListener('click', confirmZoom);
$('#zdel').addEventListener('click', trashZoom);
$('#zback').addEventListener('click', confirmZoom);
chips.addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c || !Z) return;
  const type = c.dataset.type, m = Z.m;
  if (type === 'sticky' && m.type === 'sticky') { const cs = ['y', 'p', 'm']; m.color = cs[(cs.indexOf(m.color) + 1) % 3]; }
  m.type = type; S.lastType = type; if (type === 'sticky') S.lastColor = m.color;
  const t = Z.z.zt.value; Z.z = mountZoom(m); Z.z.zt.value = t; updateChips();
  if (!RM.matches) Z.z.el.animate([{ transform: 'translateY(16px) rotate(-2deg)', opacity: .5 }, { transform: 'none', opacity: 1 }], { duration: 240, easing: 'cubic-bezier(.2,.8,.3,1)' });
});
$('#pad').addEventListener('click', () => {
  if (Z) return;
  const r = Math.random;
  const m = { id: uid(), type: S.lastType || 'memo', color: S.lastColor || 'y', text: '', x: .26 + r() * .48, y: .3 + r() * .34, rot: (r() - .5) * 24, created: now(), touched: now(), z: 0, seed: (r() * 1e9) | 0, no: ++S.no };
  Z = { mode: 'new', m };
  openZoom(padOrigin(), 'new');
});

/* ---------- wastebasket ---------- */
const BALLS = [[19, 18, -10], [33, 15, 30], [26, 30, 70], [40, 30, -40], [15, 32, 15], [31, 42, 50], [20, 44, -60]];
function renderBin(bump) {
  const n = S.memos.filter(m => m.trashed).length, bin = $('#bin');
  bin.innerHTML = BALLS.slice(0, Math.min(n, BALLS.length)).map(([x, y, a]) => `<span class="ball" style="left:${x}px;top:${y}px;transform:rotate(${a}deg)"></span>`).join('');
  bin.setAttribute('aria-label', n ? `ゴミ箱を開く(${n}枚)` : 'ゴミ箱を開く(空)');
  if (bump && !RM.matches) bin.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1) rotate(-4deg)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
}

/* ---------- bottom sheet ---------- */
const panel = $('#panel'), scrim = $('#scrim'), inner = $('#panelInner');
let panelKind = null, resetArmed = false;
function openPanel(kind) { panelKind = kind; resetArmed = false; renderPanel(); panel.classList.add('on'); scrim.classList.add('on'); }
function closePanel() { panel.classList.remove('on'); scrim.classList.remove('on'); panelKind = null; }
scrim.addEventListener('click', closePanel);
function dateJP(t) { const d = new Date(t); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WD[d.getDay()]})`; }
function renderPanel() {
  if (panelKind === 'settings') {
    const ff = Math.round(S.offset / DAY);
    panel.setAttribute('aria-label', '時間と沈み方');
    inner.innerHTML = `
      <h2>時間と沈み方<button class="x" data-act="close" aria-label="閉じる">×</button></h2>
      <h3>沈む速さ</h3>
      <p>触らない紙が、この期間で机の底まで沈みます。</p>
      <div class="seg" role="group" aria-label="沈む速さ">
        ${[[3, '3日'], [7, '1週間'], [14, '2週間'], [30, '1か月']].map(([d, l]) => `<button data-sink="${d}" aria-pressed="${S.sinkDays === d}">${l}</button>`).join('')}
      </div>
      <h3>時間を早送りする</h3>
      <p>沈み方を試すために、この机の時計だけを進めます。</p>
      <div class="today">${dateJP(now())}${ff ? `<span class="ff">${ff}日先</span>` : ''}</div>
      <div class="row">
        <button class="btn" data-ff="1">＋1日</button>
        <button class="btn" data-ff="7">＋1週間</button>
        <button class="btn quiet" data-ff="0">今日に戻す</button>
      </div>
      <h3>光の時刻</h3>
      <p>${isDark() ? 'ダークモードでは卓上ライトの光になります。窓の光はライトモードで動きます。' : '窓の光は実際の時刻に合わせて動きます。夕方は日が傾くにつれて卓上ライトが少しずつ点き、朝は明るくなると消えます。動かすと一日の光を試せます。'}</p>
      <div class="hour"><input type="range" id="hourR" min="5" max="20" step="0.25" value="${hourNow().toFixed(2)}" aria-label="光の時刻"><output id="hourO">${fmtH(hourNow())}</output></div>
      ${hourOverride !== null ? '<div class="row"><button class="btn quiet" data-act="hournow">今の時刻に戻す</button></div>' : ''}
      <h3>机を最初の状態に戻す</h3>
      <div class="row"><button class="btn quiet" data-act="reset">${resetArmed ? 'もう一度押すと戻します' : 'サンプルの机に戻す'}</button></div>
      ${resetArmed ? '<p class="warn">いま机とゴミ箱にある紙はすべて消えます。</p>' : ''}`;
  } else if (panelKind === 'bin') {
    const list = S.memos.filter(m => m.trashed).sort((a, b) => b.trashedAt - a.trashedAt);
    panel.setAttribute('aria-label', 'ゴミ箱');
    inner.innerHTML = `
      <h2>ゴミ箱<button class="x" data-act="close" aria-label="閉じる">×</button></h2>
      ${list.length ? `<p>捨てた紙は消えずにここに残ります。拾うと机のいちばん上に戻ります。</p>
      <ul class="trash-list">${list.map(m => {
        const d = new Date(m.trashedAt);
        return `<li><i class="sw ${m.type === 'memo' ? '' : 'sw-' + m.type} c-${m.color || 'y'}"></i>
          <div class="t"><b>${esc(m.text.split('\n')[0] || '白紙')}</b><span>${d.getMonth() + 1}/${d.getDate()}に捨てた</span></div>
          <button class="btn" data-restore="${m.id}">拾う</button></li>`;
      }).join('')}</ul>` : '<p>ゴミ箱は空です。拡大した紙の「捨てる」を押すと、丸めてここに入ります。</p>'}`;
  }
}
let lightPending = false;
inner.addEventListener('input', e => {
  if (e.target.id !== 'hourR') return;
  const first = hourOverride === null;
  hourOverride = +e.target.value; $('#hourO').textContent = fmtH(hourOverride);
  if (!lightPending) { lightPending = true; requestAnimationFrame(() => { lightPending = false; drawMat(); }); }
  if (first) e.target.addEventListener('change', () => renderPanel(), { once: true });
});
inner.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.act === 'close') return closePanel();
  if (b.dataset.sink) { S.sinkDays = +b.dataset.sink; ageAll(); save(); renderPanel(); return; }
  if (b.dataset.ff !== undefined) { const n = +b.dataset.ff; S.offset = n ? S.offset + n * DAY : 0; ageAll(); updateClock(); save(); renderPanel(); return; }
  if (b.dataset.act === 'hournow') { hourOverride = null; drawMat(); renderPanel(); return; }
  if (b.dataset.act === 'reset') {
    if (!resetArmed) { resetArmed = true; renderPanel(); return; }
    closePanel(); seed(); buildAll(true); save(); return;
  }
  if (b.dataset.restore) {
    const m = S.memos.find(x => x.id === b.dataset.restore); if (!m) return;
    m.trashed = false; m.touched = now(); m.z = ++S.z;
    m.x = .5 + (Math.random() - .5) * .3; m.y = .46 + (Math.random() - .5) * .22; m.rot = (Math.random() - .5) * 20;
    closePanel(); renderBin();
    const st = makeEl(m); drop(st, 180); puff(st); save();
  }
});
$('#bin').addEventListener('click', () => { if (!Z) openPanel('bin'); });
$('#clock').addEventListener('click', () => { if (!Z) openPanel('settings'); });
function updateClock() {
  const d = new Date(now()), ff = Math.round(S.offset / DAY);
  $('#clockLabel').innerHTML = `${d.getMonth() + 1}/${d.getDate()} ${WD[d.getDay()]}${ff ? ` <span class="ff">+${ff}日</span>` : ''}`;
}
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (panelKind) closePanel(); else if (Z) confirmZoom();
});

/* ---------- sample desk ---------- */
function seed() {
  const t = Date.now();
  S.memos = []; S.z = 0; S.no = 0; S.offset = 0;
  const data = [
    ['note', '今年の目標\n毎朝10分、日記を書く\n週に一度は遠回りして帰る', 40, .42, .44, -8],
    ['sticky', '鍵の置き場所を\n決める', 33, .63, .38, 11, 'y'],
    ['memo', '電池\n単3が残り2本\n単4はなし', 26, .33, .56, 4],
    ['receipt', 'パン屋\nくるみパン 280円\nまた買う', 21, .71, .6, -6],
    ['sticky', '週末\nベランダの鉢を\n植え替える', 16, .47, .29, -12, 'm'],
    ['note', '旅行先の候補\n・長崎\n・五島\n・臼杵', 12, .6, .66, 7],
    ['memo', 'アプリ案\n散らかしたままで\nいいメモ帳。\n検索窓はあえて\n置かない。', 7, .29, .34, -5],
    ['sticky', '歯医者に\n予約の電話', 5, .74, .27, 14, 'p'],
    ['receipt', 'クリーニング\n木曜までに引き取り\n控え 0418', 2, .27, .7, -10],
    ['sticky', '牛乳\n卵\n食パン\nトイレットペーパー', .4, .68, .47, 6, 'y'],
    ['note', 'つくえの使い方\n紙はつまんで動かせる\nタップで手に取る\n何もない所をなぞると\n紙をかき分けられる\n触らない紙は\n沈んでいく\n(最初の紙はサンプル)', 0, .45, .51, -3]
  ];
  data.forEach(([type, text, days, x, y, rot, color]) => {
    const tt = t - days * DAY;
    S.memos.push({ id: uid(), type, text, color: color || 'y', x, y, rot, created: tt, touched: tt, z: ++S.z, seed: (Math.random() * 1e9) | 0, no: ++S.no });
  });
}
function buildAll(animate) {
  els.forEach(st => st.root.remove()); els.clear();
  const live = S.memos.filter(m => !m.trashed).sort((a, b) => a.z - b.z);
  live.forEach((m, i) => { const st = makeEl(m); if (animate) drop(st, 120 + i * 55); });
  renderBin(); updateClock();
}

/* ---------- layout ---------- */
let rT;
function layout() {
  const ow = W; W = innerWidth; H = innerHeight;
  els.forEach(st => { sizeEl(st); if (Math.abs(W - ow) > 40) paintSheet(st.root, st.m, st.w); });
  drawMat();
}
addEventListener('resize', () => { if (Z) { pendingLayout = true; return; } clearTimeout(rT); rT = setTimeout(layout, 120); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawMat);
new MutationObserver(drawMat).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
setInterval(() => { ageAll(); updateClock(); if (hourOverride === null) drawMat(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { ageAll(); updateClock(); } });

makeGrain();
makeFilm();
const had = load();
if (!had) seed();
if (!S.woodSeed) S.woodSeed = 1 + Math.floor(Math.random() * 90);   // every desk gets its own boards
drawMat();
buildAll(true);
if (!had) save();
startAtmos();
})();

/* install support: offline cache, and ask the browser to keep this desk's data */
if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
