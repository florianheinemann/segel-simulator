// 3D-Darstellung aus Sicht des Rudergängers (three.js)
import * as THREE from 'three';
import { DEG, Sim, bftToMs } from './sim';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// Bootskoordinaten: x = Steuerbord, y = oben, z = achtern (Bug bei -z)
const MAST_Z = -1;
const MAST_TOP = 16.5;
const BOOM_Y = 3.1;
const BOOM_LEN = 4.4;
const JIB_TACK = V(0, 1.2, -6.3);
const JIB_HEAD = V(0, 15.0, -1.25);
const JIB_FOOT = 5.7;
const EYE = V(0, 2.9, 4.5);
const COAST_R = 7000;
const HORIZON = new THREE.Color(0xcfe2ec);
const LOOK_PITCH = -0.05;
// Verklicker-Lupe: weiter Blick nach oben am Mast entlang, so dass Saling und Segel im Bild sind
const VANE_FOV = 36;
const VANE_AIM_Y = 12.4;

/** Segel als verformbares Dreiecksgitter mit Bauch nach Lee */
class Sail {
  static N = 8;
  static M = 12;
  mesh: THREE.Mesh;
  private pos: Float32Array;
  private tack = V(0, 0, 0);
  private head = V(0, 0, 0);
  private clew = V(0, 0, 0);
  private lee = V(1, 0, 0);
  private camber = 0;
  private flap = 0;
  private time = 0;
  chord = V(0, 0, 1);

  constructor(mat: THREE.Material) {
    const { N, M } = Sail;
    this.pos = new Float32Array((N + 1) * (M + 1) * 3);
    const idx: number[] = [];
    for (let j = 0; j < M; j++)
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
  }

  /** Punkt auf dem Segel: t = Vorliek→Achterliek, s = Fuß→Kopf */
  point(t: number, s: number, out = V(0, 0, 0)): THREE.Vector3 {
    out.copy(this.tack).lerp(this.clew, t).lerp(this.head, s);
    const shape = Math.sin(Math.PI * t) * (1 - 0.85 * s);
    const L = this.chord.length();
    const belly =
      L * this.camber * shape * (1 - this.flap) +
      L * 0.06 * this.flap * shape * Math.sin(this.time * 15 + s * 9 + t * 4);
    return out.addScaledVector(this.lee, belly);
  }

  set(tack: THREE.Vector3, head: THREE.Vector3, clew: THREE.Vector3, leeX: number, camber: number, flap: number, time: number) {
    this.tack.copy(tack);
    this.head.copy(head);
    this.clew.copy(clew);
    this.chord.subVectors(clew, tack).setY(0);
    this.lee.set(this.chord.z, 0, -this.chord.x).normalize();
    if (this.lee.x * leeX < 0) this.lee.negate();
    this.camber = camber;
    this.flap = flap;
    this.time = time;
    const { N, M } = Sail;
    const p = V(0, 0, 0);
    let k = 0;
    for (let j = 0; j <= M; j++)
      for (let i = 0; i <= N; i++) {
        this.point(i / N, j / M, p);
        this.pos[k++] = p.x;
        this.pos[k++] = p.y;
        this.pos[k++] = p.z;
      }
    const geo = this.mesh.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }
}

/** Windfaden: schmaler Streifen, am vorderen Ende befestigt */
class Telltale {
  mesh: THREE.Mesh;
  private phase = Math.random() * 10;
  private angle = 0;
  constructor(color: number, len = 0.55) {
    const g = new THREE.BoxGeometry(len, 0.07, 0.012);
    g.translate(len / 2, 0, 0);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color }));
    this.mesh.rotation.order = 'YZX';
  }
  /**
   * mode: 'stream' liegt an, 'flutter' steigt/flattert, 'hang' hängt schlaff
   */
  set(pos: THREE.Vector3, dir: THREE.Vector3, mode: 'stream' | 'flutter' | 'hang', time: number, dt: number, yawOff = 0) {
    const t = time + this.phase;
    let target: number;
    if (mode === 'stream') target = 4 * Math.sin(t * 9) * DEG;
    else if (mode === 'flutter') target = (55 + 45 * Math.sin(t * 7) + 20 * Math.sin(t * 17)) * DEG;
    else target = -80 * DEG;
    this.angle += (target - this.angle) * Math.min(1, dt * 10);
    this.mesh.position.copy(pos);
    this.mesh.rotation.y = Math.atan2(-dir.z, dir.x) + yawOff;
    this.mesh.rotation.z = this.angle;
  }
}

const seaVert = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const seaFrag = /* glsl */ `
precision highp float;
varying vec3 vW;
uniform float uTime;
uniform vec2 uDir;      // Laufrichtung der Wellen
uniform float uWind;    // 0..1
uniform vec3 uGust;     // x, z, Radius (0 = keine)
uniform vec3 uCam;
uniform vec3 uHorizon;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
void main() {
  vec2 p = vW.xz;
  float dist = length(p - uCam.xz);
  float a1 = 1.0 / (1.0 + dist * 0.003);
  float a2 = 1.0 / (1.0 + dist * 0.02);
  float a3 = 1.0 / (1.0 + dist * 0.06);
  float sw = sin(dot(p, uDir) * 0.22 - uTime * 1.5);
  float n = 0.5 * sw * a1
          + 0.3 * sin(dot(p, rot(uDir, 0.5)) * 0.55 - uTime * 2.3) * a2
          + 0.25 * sin(dot(p, rot(uDir, -0.8)) * 1.4 - uTime * 3.6) * a3;
  float patch1 = noise(p * 0.5 - uDir * uTime * 0.5);
  n += (patch1 - 0.5) * 0.6 * a2;
  vec3 deep = vec3(0.04, 0.20, 0.34);
  vec3 light = vec3(0.15, 0.42, 0.56);
  vec3 col = mix(deep, light, clamp(0.5 + 0.55 * n, 0.0, 1.0));
  // Schaumkronen ab ca. 4 Bft
  float crest = noise(p * 0.9 - uDir * uTime * 1.3) * 0.65 + 0.35 * (0.5 + 0.5 * sw);
  float foam = smoothstep(0.98 - 0.3 * uWind, 1.0 - 0.22 * uWind, crest) * a2 * 2.5;
  col = mix(col, vec3(0.93), clamp(foam, 0.0, 0.85) * smoothstep(0.3, 0.5, uWind));
  // Bö: dunkler, gekräuselter Fleck
  if (uGust.z > 0.0) {
    float g = 1.0 - smoothstep(uGust.z * 0.6, uGust.z, length(p - uGust.xy));
    col *= 1.0 - 0.38 * g;
  }
  col = mix(col, uHorizon, smoothstep(150.0, 9000.0, dist));
  gl_FragColor = vec4(col, 1.0);
}`;

export class View {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(62, 2, 0.3, 40000);
  private vaneCam = new THREE.PerspectiveCamera(VANE_FOV, 1, 1, 40000);
  /** Position der Marke „vorn“ in der Verklicker-Lupe (-1..1 von der Mitte, y nach unten) */
  vaneBow = { x: 0, y: 1 };
  private tellCam = new THREE.PerspectiveCamera(11, 1, 1, 40000);
  private yawG = new THREE.Group();
  private heelG = new THREE.Group();
  private eyeG = new THREE.Group();
  private sea: THREE.Mesh;
  private seaU: Record<string, THREE.IUniform>;
  private sky: THREE.Mesh;
  private boomMesh!: THREE.Mesh;
  private main: Sail;
  private jibSail: Sail;
  private vane = new THREE.Group();
  private wheel = new THREE.Group();
  private jibTT: { port: Telltale; stb: Telltale; s: number }[] = [];
  private mainTT: { tt: Telltale; s: number }[] = [];
  private luvX = 1.2;
  private vaneAngle = 0;
  private time = 0;
  lookYaw = 0;
  lookPitch = LOOK_PITCH;
  /** true, solange der Blick zurück nach voraus schwenkt */
  recentering = false;
  get lookedAway() {
    return Math.abs(this.lookYaw) > 0.02 || Math.abs(this.lookPitch - LOOK_PITCH) > 0.02;
  }
  /** 'jib' oder 'main' – worauf das Fäden-Fenster zielt */
  tellTarget: 'jib' | 'main' = 'jib';
  private insets: { ctx: CanvasRenderingContext2D; cam: THREE.Camera }[];

  constructor(private canvas: HTMLCanvasElement, vaneCanvas: HTMLCanvasElement, tellCanvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.insets = [
      { ctx: vaneCanvas.getContext('2d')!, cam: this.vaneCam },
      { ctx: tellCanvas.getContext('2d')!, cam: this.tellCam },
    ];
    const sc = this.scene;
    sc.add(new THREE.HemisphereLight(0xffffff, 0x4a6a80, 1.5));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
    sun.position.set(-0.4, 1, 0.5);
    sc.add(sun);

    // Himmel
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(30000, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uHorizon: { value: HORIZON } },
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vP; uniform vec3 uHorizon; void main(){ float h = clamp(normalize(vP).y, 0.0, 1.0); gl_FragColor = vec4(mix(uHorizon, vec3(0.20,0.47,0.78), pow(h, 0.55)), 1.0); }`,
      }),
    );
    this.sky.renderOrder = -2;
    sc.add(this.sky);

    // Wasser
    this.seaU = {
      uTime: { value: 0 },
      uDir: { value: new THREE.Vector2(0, 1) },
      uWind: { value: 0.5 },
      uGust: { value: new THREE.Vector3() },
      uCam: { value: new THREE.Vector3() },
      uHorizon: { value: HORIZON },
    };
    const seaGeo = new THREE.PlaneGeometry(60000, 60000);
    seaGeo.rotateX(-Math.PI / 2);
    this.sea = new THREE.Mesh(seaGeo, new THREE.ShaderMaterial({ uniforms: this.seaU, vertexShader: seaVert, fragmentShader: seaFrag }));
    this.sea.renderOrder = -1;
    sc.add(this.sea);

    this.buildCoast();
    this.buildBoat();
    this.main = new Sail(new THREE.MeshLambertMaterial({ color: 0xf6f4ee, emissive: 0x4a4a48, side: THREE.DoubleSide }));
    this.jibSail = new Sail(new THREE.MeshLambertMaterial({ color: 0xf6f4ee, emissive: 0x4a4a48, side: THREE.DoubleSide, transparent: true, opacity: 0.78 }));
    this.heelG.add(this.main.mesh, this.jibSail.mesh);

    // Windfäden: Fock (Luv/Lee-Paar, Bb rot / Stb grün), Groß (Achterliek)
    for (const s of [0.22, 0.42, 0.62]) {
      const port = new Telltale(0xd62828), stb = new Telltale(0x1f9d55);
      this.jibTT.push({ port, stb, s });
      this.heelG.add(port.mesh, stb.mesh);
    }
    for (const s of [0.3, 0.5, 0.7]) {
      const tt = new Telltale(0xd62828, 0.6);
      this.mainTT.push({ tt, s });
      this.heelG.add(tt.mesh);
    }

    this.yawG.add(this.heelG, this.eyeG);
    this.eyeG.add(this.cam);
    this.cam.rotation.order = 'YXZ';
    sc.add(this.yawG, this.vaneCam, this.tellCam);
  }

  /** Rote Marken (Bügel) am Verklicker ein- oder ausblenden */
  setVaneTabs(on: boolean) {
    for (const c of this.vane.children) if (c.name === 'tab') c.visible = on;
  }

  private marksG = new THREE.Group();
  /** Tonnen des Kurses zeichnen: die nächste (hervorgehoben) und die danach */
  setCourse(marks: { x: number; z: number }[], idx: number) {
    this.marksG.clear();
    if (!this.marksG.parent) this.scene.add(this.marksG);
    marks.forEach((m, i) => {
      if (i < idx || i > idx + 1) return;
      const active = i === idx;
      const mat = new THREE.MeshBasicMaterial({ color: active ? 0xff8c1a : 0xb9c2c9 });
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 3, 12), mat);
      body.position.y = 1.2;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), new THREE.MeshBasicMaterial({ color: 0x222222 }));
      pole.position.y = 6;
      const top = new THREE.Mesh(new THREE.SphereGeometry(active ? 1.1 : 0.7, 12, 8), mat);
      top.position.y = 9.5;
      g.add(body, pole, top);
      g.position.set(m.x, 0, m.z);
      this.marksG.add(g);
    });
  }
  /** Bildschirmposition (0..1) eines Punkts in der Hauptansicht; null, wenn nicht im Bild */
  project(x: number, y: number, z: number): { x: number; y: number } | null {
    const v = V(x, y, z).project(this.cam);
    if (v.z > 1 || Math.abs(v.x) > 0.98 || Math.abs(v.y) > 0.98) return null;
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  private buildCoast() {
    // Hügelkette rund um das Revier
    const seg = 360;
    const pos: number[] = [];
    const idx: number[] = [];
    const hgt = (a: number) =>
      Math.max(40, 230 + 170 * Math.sin(a * 3 + 1) + 110 * Math.sin(a * 7 + 2) + 60 * Math.sin(a * 17) + 40 * Math.sin(a * 31 + 4));
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const x = Math.sin(a), z = -Math.cos(a);
      pos.push(x * COAST_R, -5, z * COAST_R, x * (COAST_R + 400), hgt(a), z * (COAST_R + 400));
      if (i < seg) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    this.scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x6f8f86, side: THREE.DoubleSide })));

    const at = (bearing: number, obj: THREE.Object3D, r = COAST_R - 150) => {
      obj.position.set(Math.sin(bearing * DEG) * r, 0, -Math.cos(bearing * DEG) * r);
      obj.rotation.y = -bearing * DEG;
      this.scene.add(obj);
    };
    const basic = (c: number) => new THREE.MeshBasicMaterial({ color: c });
    // Leuchtturm (rot-weiß) im Nordosten
    const lh = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(26 - i * 2, 28 - i * 2, 60, 12), basic(i % 2 ? 0xf2efe8 : 0xc0392b));
      m.position.y = 30 + i * 60;
      lh.add(m);
    }
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 40, 12), basic(0x2b2b2b));
    lamp.position.y = 380;
    lh.add(lamp);
    at(30, lh);
    // Kirche im Südosten
    const ch = new THREE.Group();
    const nave = new THREE.Mesh(new THREE.BoxGeometry(160, 110, 80), basic(0xe8e2d4));
    nave.position.set(60, 55, 0);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(60, 240, 60), basic(0xe8e2d4));
    tower.position.y = 120;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(46, 170, 4), basic(0x6b3d2e));
    spire.position.y = 325;
    spire.rotation.y = Math.PI / 4;
    ch.add(nave, tower, spire);
    at(120, ch);
    // Windräder im Südwesten
    for (const b of [205, 212, 219]) {
      const wt = new THREE.Group();
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(7, 11, 330, 8), basic(0xf4f4f4));
      tw.position.y = 165;
      wt.add(tw);
      for (let k = 0; k < 3; k++) {
        const bl = new THREE.Mesh(new THREE.BoxGeometry(11, 150, 5), basic(0xf4f4f4));
        bl.geometry.translate(0, 75, 0);
        bl.position.set(0, 330, 14);
        bl.rotation.z = (k * 120 + b * 7) * DEG;
        wt.add(bl);
      }
      at(b, wt);
    }
    // Funkmast im Nordwesten
    const fm = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 60, 6), basic(i % 2 ? 0xf2efe8 : 0xd0452f));
      m.position.y = 30 + i * 60;
      fm.add(m);
    }
    at(300, fm);
  }

  private buildBoat() {
    const g = this.heelG;
    const white = new THREE.MeshLambertMaterial({ color: 0xf2f2ee });
    const deckMat = new THREE.MeshLambertMaterial({ color: 0xcdb892 });
    const alu = new THREE.MeshLambertMaterial({ color: 0x9aa3ab });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2c3238 });

    // Rumpf: Decksumriss nach unten extrudiert
    const sh = new THREE.Shape();
    sh.moveTo(0, 6.6);
    sh.bezierCurveTo(1.2, 4.5, 1.95, 1.5, 1.95, -1.5);
    sh.bezierCurveTo(1.95, -3.4, 1.75, -4.6, 1.6, -5);
    sh.lineTo(-1.6, -5);
    sh.bezierCurveTo(-1.75, -4.6, -1.95, -3.4, -1.95, -1.5);
    sh.bezierCurveTo(-1.95, 1.5, -1.2, 4.5, 0, 6.6);
    const hullGeo = new THREE.ExtrudeGeometry(sh, { depth: 1.3, bevelEnabled: false, curveSegments: 16 });
    hullGeo.rotateX(-Math.PI / 2);
    hullGeo.translate(0, -0.3, 0);
    g.add(new THREE.Mesh(hullGeo, [deckMat, white]));

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 4.6), white);
    roof.position.set(0, 1.25, -1.4);
    g.add(roof);
    for (const x of [-1.06, 1.06]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 3.2), dark);
      win.position.set(x, 1.3, -1.4);
      g.add(win);
    }
    // Cockpitsülls
    for (const x of [-1.25, 1.25]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 3.6), white);
      c.position.set(x, 1.2, 2.9);
      g.add(c);
    }

    const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
      g.add(m);
      return m;
    };
    const top = V(0, MAST_TOP, MAST_Z);
    rod(V(0, 1, MAST_Z), top, 0.1, alu); // Mast
    rod(JIB_TACK.clone().setY(1), V(0, 15.3, MAST_Z - 0.1), 0.015, dark); // Vorstag
    rod(top, V(0, 1, 4.9), 0.015, dark); // Achterstag
    for (const x of [-1.8, 1.8]) {
      rod(V(0, 11, MAST_Z), V(x, 1, MAST_Z + 0.3), 0.015, dark); // Wanten
      rod(V(x * 0.55, 8.5, MAST_Z), V(-x * 0.55, 8.5, MAST_Z), 0.03, alu); // Saling
    }

    // Baum (dreht um den Mast)
    const boomGeo = new THREE.CylinderGeometry(0.08, 0.08, BOOM_LEN, 8);
    boomGeo.rotateX(Math.PI / 2);
    boomGeo.translate(0, 0, BOOM_LEN / 2);
    this.boomMesh = new THREE.Mesh(boomGeo, alu);
    this.boomMesh.position.set(0, BOOM_Y, MAST_Z);
    g.add(this.boomMesh);

    // Verklicker: Pfeil zeigt in den Wind, zwei feste Marken nach achtern
    this.vane.position.set(0, MAST_TOP + 0.45, MAST_Z);
    const black = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
    const red = new THREE.MeshBasicMaterial({ color: 0xd62828, side: THREE.DoubleSide });
    rod(top, top.clone().setY(MAST_TOP + 0.45), 0.02, dark);
    const arrow = new THREE.Group();
    const tri = (pts: number[], mat: THREE.Material) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      return new THREE.Mesh(geo, mat);
    };
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.95), black);
    arrow.add(shaft);
    arrow.add(tri([0, 0, -0.66, -0.15, 0, -0.3, 0.15, 0, -0.3], black)); // Spitze
    arrow.add(tri([0, 0, 0.2, -0.16, 0, 0.62, 0.16, 0, 0.62], black)); // Fahne
    arrow.name = 'arrow';
    this.vane.add(arrow);
    for (const sgn of [-1, 1]) {
      const arm = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.5), black);
      bar.position.z = 0.25;
      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.11), red);
      tab.position.z = 0.52;
      arm.add(bar, tab);
      arm.rotation.y = sgn * 32 * DEG;
      arm.position.y = -0.06;
      arm.name = 'tab';
      this.vane.add(arm);
    }
    // bewusst überzeichnet, damit er in der Lupe trotz weitem Ausschnitt lesbar bleibt
    this.vane.scale.setScalar(2.6);
    g.add(this.vane);

    // Steuersäule und Rad
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 0.28), white);
    ped.position.set(0, 1.45, 3.05);
    g.add(ped);
    const comp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), dark);
    comp.position.set(0, 1.97, 3.05);
    g.add(comp);
    this.wheel.position.set(0, 1.75, 3.25);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 8, 32), alu);
    this.wheel.add(rim);
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.55, 0.02), i === 0 ? new THREE.MeshLambertMaterial({ color: 0xd62828 }) : alu);
      sp.geometry.translate(0, 0.275, 0);
      sp.rotation.z = i * 60 * DEG;
      this.wheel.add(sp);
    }
    g.add(this.wheel);
  }

  private sized = '';
  /** Passt die Zeichenfläche an, sobald sich die Größe ändert – wird in jedem Bild geprüft,
   *  weil iOS beim Drehen das resize-Ereignis teils vor dem neuen Layout meldet. */
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    const key = `${w}x${h}@${pr}/${this.insets.map((i) => i.ctx.canvas.clientWidth).join('/')}`;
    if (key === this.sized || w === 0 || h === 0) return;
    this.sized = key;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h;
    // auf schmalen Bildschirmen etwas weitwinkliger
    this.cam.fov = w / h > 1.9 ? 58 : 64;
    this.cam.updateProjectionMatrix();
    // jede Lupe in ihrer eigenen Größe
    for (const { ctx } of this.insets) {
      const c = ctx.canvas;
      c.width = c.height = Math.min(Math.round(c.clientWidth * pr), Math.floor(Math.min(w, h) * pr));
    }
  }

  update(sim: Sim, dt: number) {
    this.time += dt;
    const t = this.time;
    const windN = Math.min(1, bftToMs(sim.cfg.bft) / 14);

    // Boot
    this.yawG.position.set(sim.x, 0.05 * Math.sin(t * 1.3) * (0.5 + windN), sim.z);
    this.yawG.rotation.y = -sim.heading * DEG;
    this.heelG.rotation.z = -sim.heel * DEG + 0.012 * Math.sin(t * 0.9) * (0.5 + 2 * windN);
    this.heelG.rotation.x = 0.012 * Math.sin(t * 1.5 + 1) * (0.5 + 2 * windN);
    this.wheel.rotation.z = -sim.rudder * 3.5 * DEG;

    // Segel
    const sm = Math.sin(sim.boom * DEG), cm = Math.cos(sim.boom * DEG);
    this.boomMesh.rotation.y = sim.boom * DEG;
    const flapM = sim.alphaMain < 2 && sim.aws > 1 ? 1 - sim.alphaMain / 2 : 0;
    this.main.set(
      V(0, BOOM_Y + 0.1, MAST_Z), V(0, MAST_TOP - 0.3 - 2.7 * sim.reef, MAST_Z),
      V(sm * BOOM_LEN, BOOM_Y + 0.1, MAST_Z + cm * BOOM_LEN),
      -sim.mainSide, 0.09, flapM, t,
    );
    const sj = Math.sin(sim.jib * DEG), cj = Math.cos(sim.jib * DEG);
    const flapJ = sim.alphaJib < 2 && sim.aws > 1 ? 1 - sim.alphaJib / 2 : 0;
    this.jibSail.set(
      JIB_TACK, JIB_TACK.clone().lerp(JIB_HEAD, 1 - 0.17 * sim.reef),
      V(JIB_TACK.x + sj * JIB_FOOT * (1 - 0.17 * sim.reef), 1.9, JIB_TACK.z + cj * JIB_FOOT * (1 - 0.17 * sim.reef)),
      sim.jibBack ? -Math.sign(sim.awa || 1) : -sim.jibSide, 0.1, flapJ, t,
    );

    // Windfäden
    const calm = sim.aws < 1 || sim.jibShadow < 0.6;
    const p = V(0, 0, 0), n = V(0, 0, 0);
    const jc = this.jibSail.chord.clone().normalize();
    n.set(jc.z, 0, -jc.x);
    if (n.x * sim.jibSide < 0) n.negate(); // n zeigt nach Luv
    for (const { port, stb, s } of this.jibTT) {
      this.jibSail.point(0.16, s, p);
      // Farben bleiben an der Bootsseite: Bb rot, Stb grün
      const luvTT = sim.jibSide > 0 ? stb : port, leeTT = sim.jibSide > 0 ? port : stb;
      const back = sim.jibBack;
      luvTT.set(p.clone().addScaledVector(n, 0.05), jc, calm ? 'hang' : back || sim.alphaJib < 8 ? 'flutter' : 'stream', t, dt);
      leeTT.set(p.clone().addScaledVector(n, -0.05), jc, calm ? 'hang' : back || sim.alphaJib > 24 || sim.alphaJib < 1 ? 'flutter' : 'stream', t, dt);
    }
    const mc = this.main.chord.clone().normalize();
    const stalled = sim.alphaMain > 26;
    for (const { tt, s } of this.mainTT) {
      this.main.point(1, s, p);
      // abgerissene Strömung: Faden klappt hinter das Achterliek nach Lee
      tt.set(p, mc, sim.aws < 1 ? 'hang' : sim.alphaMain < 2 ? 'flutter' : 'stream', t, dt,
        stalled ? sim.mainSide * (110 + 25 * Math.sin(t * 6 + s * 9)) * DEG : 0);
    }

    // Verklicker (leicht gedämpft, zittert etwas)
    const target = sim.awa + 2.5 * Math.sin(t * 5.3) + 1.5 * Math.sin(t * 11.1);
    let d = target - this.vaneAngle;
    d = ((d + 540) % 360) - 180;
    this.vaneAngle += d * Math.min(1, dt * 5);
    this.vane.getObjectByName('arrow')!.rotation.y = -this.vaneAngle * DEG;

    // Auge des Rudergängers: sitzt in Luv
    const luvTarget = (sim.awa >= 0 ? 1 : -1) * 1.2;
    this.luvX += (luvTarget - this.luvX) * Math.min(1, dt * 1.5);
    this.eyeG.position.set(this.luvX, EYE.y, EYE.z);
    if (this.recentering) {
      this.lookYaw += (0 - this.lookYaw) * Math.min(1, dt * 6);
      this.lookPitch += (LOOK_PITCH - this.lookPitch) * Math.min(1, dt * 6);
      if (!this.lookedAway) {
        this.lookYaw = 0;
        this.lookPitch = LOOK_PITCH;
        this.recentering = false;
      }
    }
    this.cam.rotation.set(this.lookPitch, this.lookYaw, 0);

    // Wasser / Himmel folgen dem Boot
    this.sea.position.set(sim.x, 0, sim.z);
    this.sky.position.set(sim.x, 0, sim.z);
    const twd = (sim.cfg.twd + sim.windShift) * DEG;
    const wdx = -Math.sin(twd), wdz = Math.cos(twd);
    this.seaU.uTime.value = t;
    (this.seaU.uDir.value as THREE.Vector2).set(wdx, wdz);
    this.seaU.uWind.value = windN;
    (this.seaU.uCam.value as THREE.Vector3).set(sim.x, 0, sim.z);
    const gu = this.seaU.uGust.value as THREE.Vector3;
    if (sim.gustEta < 14 && sim.gustFactor >= 1) {
      const dist = Math.max(0, sim.gustEta) * 9;
      const fade = sim.gustEta < 0 && sim.gustFactor < 1.03 ? 0 : 1;
      gu.set(sim.x - wdx * dist, sim.z - wdz * dist, 110 * fade);
    } else gu.z = 0;

    // Lupen-Kameras vom Auge aus
    this.scene.updateMatrixWorld();
    const eye = this.eyeG.getWorldPosition(V(0, 0, 0));
    this.vaneCam.position.copy(eye);
    this.vaneCam.lookAt(this.heelG.localToWorld(p.set(0, VANE_AIM_Y, MAST_Z)));
    this.vaneCam.updateMatrixWorld();
    // wohin zeigt „voraus“ im Bild? (für die Marke am Lupenrand)
    const top = this.heelG.localToWorld(V(0, MAST_TOP + 0.45, MAST_Z)).project(this.vaneCam);
    const ahead = this.heelG.localToWorld(V(0, MAST_TOP + 0.45, MAST_Z - 3)).project(this.vaneCam);
    const dx = ahead.x - top.x, dy = ahead.y - top.y;
    const len = Math.hypot(dx, dy) || 1;
    // Marke sitzt vom Verklicker aus in Richtung Bug, bleibt aber innerhalb der Lupe
    let bx = top.x + (dx / len) * 0.42, by = top.y + (dy / len) * 0.42;
    const r = Math.hypot(bx, by);
    if (r > 0.8) { bx *= 0.8 / r; by *= 0.8 / r; }
    this.vaneBow.x = bx;
    this.vaneBow.y = -by;
    this.tellCam.position.copy(eye);
    if (this.tellTarget === 'jib') {
      this.jibSail.point(0.19, 0.42, p);
      this.tellCam.fov = 9;
      // Bei gefierter Fock läge der Mast genau in der Sichtlinie. Der Rudergänger
      // lehnt sich dann weiter nach Luv, bis er am Mast vorbei auf die Fäden sieht.
      const side = this.luvX >= 0 ? 1 : -1;
      const tl = this.yawG.worldToLocal(this.heelG.localToWorld(p.clone()));
      const f = (EYE.z - MAST_Z) / (EYE.z - tl.z);
      const hLine = EYE.y + f * (tl.y - EYE.y);
      const mx = this.yawG.worldToLocal(this.heelG.localToWorld(V(0, hLine, MAST_Z))).x;
      const need = (0.4 + side * (mx - f * tl.x)) / (1 - f);
      const ex = side * Math.min(2.1, Math.max(Math.abs(this.luvX), need));
      this.tellCam.position.copy(this.yawG.localToWorld(V(ex, EYE.y, EYE.z)));
    } else {
      this.main.point(0.9, 0.5, p);
      this.tellCam.fov = 30;
    }
    this.tellCam.updateProjectionMatrix();
    this.tellCam.lookAt(this.heelG.localToWorld(p));
  }

  render() {
    this.resize();
    const r = this.renderer;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const pr = r.getPixelRatio();
    r.setScissorTest(true);
    for (const { ctx, cam } of this.insets) {
      const px = ctx.canvas.width, S = px / pr;
      if (!px) continue;
      r.setViewport(0, 0, S, S);
      r.setScissor(0, 0, S, S);
      r.render(this.scene, cam);
      ctx.drawImage(this.canvas, 0, this.canvas.height - px, px, px, 0, 0, px, px);
    }
    r.setScissorTest(false);
    r.setViewport(0, 0, w, h);
    r.render(this.scene, this.cam);
  }
}
