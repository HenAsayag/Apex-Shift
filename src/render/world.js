import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createVehicle } from "./vehicle.js";
import { mod, lerp } from "../config.js";

const UP = new THREE.Vector3(0, 1, 0);
const seeded = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
function labelTexture(
  text,
  bg = "#161c20",
  fg = "#ffffff",
  width = 1024,
  height = 160,
) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = fg;
  ctx.font = `900 ${height * 0.58}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height * 0.53, width * 0.9);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export class World {
  constructor(canvas, settings) {
    this.touchDevice =
      navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.touchDevice,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0, 0.1, 100, { size: 64 }).texture;
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = 0.5;
    room.dispose();
    pmrem.dispose();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.cameras = Array.from(
      { length: 4 },
      () => new THREE.PerspectiveCamera(57, 1, 0.1, 1800),
    );
    this.cars = [];
    this.cameraReady = false;
    this.clock = 0;
    this.particles = [];
    this.particleGeo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(320 * 3);
    this.particleGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.particlePositions, 3),
    );
    const particleCanvas = document.createElement("canvas");
    particleCanvas.width = particleCanvas.height = 32;
    const pc = particleCanvas.getContext("2d"),
      gradient = pc.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.35, "#ffffffbb");
    gradient.addColorStop(1, "#ffffff00");
    pc.fillStyle = gradient;
    pc.fillRect(0, 0, 32, 32);
    this.particleTexture = new THREE.CanvasTexture(particleCanvas);
    this.particleMesh = new THREE.Points(
      this.particleGeo,
      new THREE.PointsMaterial({
        color: "#ebbc86",
        size: 1.3,
        map: this.particleTexture,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);
    this.applySettings(settings);
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }
  applySettings(s) {
    this.settings = s;
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, this.touchDevice ? 1.25 : 1.7) *
        s.resolution *
        (s.graphics === "low" ? 0.7 : s.graphics === "medium" ? 0.85 : 1),
    );
    this.renderer.shadowMap.enabled = s.shadows && s.graphics !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.resize();
  }
  resize() {
    this.width = innerWidth;
    this.height = innerHeight;
    this.renderer.setSize(this.width, this.height);
    this.cameraReady = false;
  }
  disposeRoot() {
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    this.root.traverse((o) => {
      if (o.isLight) o.dispose?.();
      if (o.geometry) geometries.add(o.geometry);
      if (o.material)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          materials.add(m);
          if (m.map) textures.add(m.map);
        });
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    this.scene.remove(this.root);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.cars = [];
    this.particles = [];
    this.cameraReady = false;
  }
  build(track, vehicle, weather = "clear", time = "day") {
    this.disposeRoot();
    this.track = track;
    const c = track.config;
    this.night = time === "night" || (time === "track" && c.night);
    this.weather = weather;
    const sky = this.night ? "#0b1228" : weather === "rain" ? "#67777c" : c.sky;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.FogExp2(sky, this.night ? 0.0019 : 0.00115);
    const hemi = new THREE.HemisphereLight(
      this.night ? "#7497f1" : "#dbeaff",
      c.ground,
      this.night ? 1.4 : 2.6,
    );
    this.root.add(hemi);
    const sun = new THREE.DirectionalLight(
      this.night ? "#a2b6ff" : "#ffe4bc",
      this.night ? 1.8 : 3.4,
    );
    sun.position.set(-100, 250, 130);
    sun.castShadow = true;
    sun.shadow.mapSize.set(
      this.settings.graphics === "high" ? 2048 : 1024,
      this.settings.graphics === "high" ? 2048 : 1024,
    );
    Object.assign(sun.shadow.camera, {
      left: -150,
      right: 150,
      top: 150,
      bottom: -150,
      near: 1,
      far: 600,
    });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.7;
    sun.target.position.set(100, 0, 70);
    this.root.add(sun, sun.target);
    this.sun = sun;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ color: c.ground, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -13;
    ground.receiveShadow = true;
    this.root.add(ground);
    this.makeRoad(track);
    this.scenery(track);
    this.skidPositions = new Float32Array(3000 * 3);
    this.skidPositions.fill(-9999);
    this.skidIndex = 0;
    this.skidGeo = new THREE.BufferGeometry();
    this.skidGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.skidPositions, 3),
    );
    const skids = new THREE.LineSegments(
      this.skidGeo,
      new THREE.LineBasicMaterial({
        color: "#101b1e",
        transparent: true,
        opacity: 0.6,
      }),
    );
    skids.frustumCulled = false;
    this.root.add(skids);
    for (const obstacle of track.obstacles) {
      const f = track.frame(obstacle.u * track.length),
        m = new THREE.Mesh(
          new THREE.BoxGeometry(2.8, 1.6, 2.2),
          new THREE.MeshStandardMaterial({ color: "#f7a044", roughness: 0.8 }),
        );
      m.position
        .copy(f.pos)
        .addScaledVector(f.right, obstacle.lane)
        .addScaledVector(f.up, 0.8);
      m.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(f.right, f.up, f.forward),
      );
      m.castShadow = true;
      this.root.add(m);
      for (const x of [-0.8, 0, 0.8]) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 1.65, 2.25),
          new THREE.MeshStandardMaterial({ color: "#182327" }),
        );
        stripe.position.x = x;
        m.add(stripe);
      }
    }
    if (c.id === "space") {
      const stars = new Float32Array(1800);
      const rnd = seeded(222);
      for (let i = 0; i < stars.length; i += 3) {
        stars[i] = (rnd() - 0.5) * 1800;
        stars[i + 1] = 100 + rnd() * 800;
        stars[i + 2] = (rnd() - 0.5) * 1800;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.BufferAttribute(stars, 3));
      this.root.add(
        new THREE.Points(
          sg,
          new THREE.PointsMaterial({ color: "#e6f5ff", size: 1.8 }),
        ),
      );
    }

    for (let i = 0; i < 4; i++)
      this.gate(
        i ? track.length * [0.25, 0.5, 0.75][i - 1] : 0,
        i ? `CHECKPOINT 0${i}` : "APEX // SHIFT",
        i ? "#53d9f1" : c.color,
      );
    for (const p of track.boosts)
      this.pad(p * track.length, "» » »", "#55d7de", 9);
    for (const p of track.ramps) {
      this.pad(p * track.length - 5, "↑  ↑  ↑", c.color, 9);
      const f = track.frame(p * track.length - 4);
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(track.width * 0.85, 0.35, 8),
        new THREE.MeshStandardMaterial({ color: "#4c5253", roughness: 0.7 }),
      );
      ramp.position.copy(f.pos).addScaledVector(f.up, 0.65);
      ramp.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(f.right, f.up, f.forward),
      );
      ramp.rotateX(-0.14);
      this.root.add(ramp);
    }
    this.pad(0, "", c.color, 4, true);
    this.hero = createVehicle(vehicle);
    this.root.add(this.hero);
    this.hero.position.copy(track.world(14, -1, 0.15));
    this.orient(this.hero, track.frame(14), 0);
    this.weatherPositions = new Float32Array(700 * 3);
    const random = seeded(48);
    for (let i = 0; i < this.weatherPositions.length; i += 3) {
      this.weatherPositions[i] = random() * 260 - 130;
      this.weatherPositions[i + 1] = random() * 90;
      this.weatherPositions[i + 2] = random() * 260 - 130;
    }
    this.weatherGeo = new THREE.BufferGeometry();
    this.weatherGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.weatherPositions, 3),
    );
    this.weatherMesh = new THREE.Points(
      this.weatherGeo,
      new THREE.PointsMaterial({
        color: weather === "snow" ? "#ffffff" : "#a9c9dc",
        size: weather === "snow" ? 0.4 : 0.17,
        transparent: true,
        opacity: 0.65,
      }),
    );
    this.weatherMesh.visible = weather !== "clear" && this.settings.effects;
    this.weatherMesh.frustumCulled = false;
    this.root.add(this.weatherMesh);
  }
  makeRoad(track) {
    const n = 800;
    const strip = (
      left,
      right,
      height,
      color,
      alternating = false,
      dashed = false,
    ) => {
      const positions = [],
        colors = [];
      const ca = new THREE.Color(color),
        cb = new THREE.Color("#e2d6bd");
      for (let i = 0; i < n; i++) {
        if (dashed && i % 12 > 4) continue;
        const a = track.frame((i / n) * track.length),
          b = track.frame(((i + 1) / n) * track.length);
        const pts = [
          a.pos
            .clone()
            .addScaledVector(a.right, left)
            .addScaledVector(a.up, height),
          a.pos
            .clone()
            .addScaledVector(a.right, right)
            .addScaledVector(a.up, height),
          b.pos
            .clone()
            .addScaledVector(b.right, left)
            .addScaledVector(b.up, height),
          b.pos
            .clone()
            .addScaledVector(b.right, right)
            .addScaledVector(b.up, height),
        ];
        const col = alternating && Math.floor(i / 3) % 2 ? cb : ca;
        for (const j of [0, 2, 1, 1, 2, 3]) {
          positions.push(...pts[j].toArray());
          colors.push(col.r, col.g, col.b);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.86,
          metalness: 0.06,
          side: THREE.DoubleSide,
        }),
      );
      mesh.receiveShadow = true;
      this.root.add(mesh);
      return mesh;
    };
    const w = track.width / 2;
    strip(-w, w, 0, "#303a3e");
    strip(-w - 1, -w, 0.035, track.config.color, true);
    strip(w, w + 1, 0.035, track.config.color, true);
    strip(-0.065, 0.065, 0.045, "#96a09e", false, true);
    strip(-w + 1.1, -w + 1.25, 0.06, "#c4bbb0");
    strip(w - 1.25, w - 1.1, 0.06, "#c4bbb0");
    // Raised edge ribbons keep collision boundaries visible at speed.
    const railMat = new THREE.MeshStandardMaterial({
      color: "#929798",
      metalness: 0.65,
      roughness: 0.5,
    });
    for (const side of [-1, 1]) {
      const verts = [];
      for (let i = 0; i < n; i++) {
        const u = i / n;
        if (track.ramps.some((p) => Math.abs(u - p) < 0.04)) continue;
        const a = track.frame(u * track.length),
          b = track.frame(((i + 1) / n) * track.length);
        const pts = [
          a.pos
            .clone()
            .addScaledVector(a.right, side * (w + 0.85))
            .addScaledVector(a.up, 0.25),
          a.pos
            .clone()
            .addScaledVector(a.right, side * (w + 0.85))
            .addScaledVector(a.up, 0.9),
          b.pos
            .clone()
            .addScaledVector(b.right, side * (w + 0.85))
            .addScaledVector(b.up, 0.25),
          b.pos
            .clone()
            .addScaledVector(b.right, side * (w + 0.85))
            .addScaledVector(b.up, 0.9),
        ];
        for (const j of [0, 1, 2, 1, 3, 2]) verts.push(...pts[j].toArray());
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      g.computeVertexNormals();
      this.root.add(
        new THREE.Mesh(
          g,
          Object.assign(railMat.clone(), { side: THREE.DoubleSide }),
        ),
      );
    }
    const supports = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2, 1, 2),
      new THREE.MeshStandardMaterial({ color: "#666c68" }),
      65,
    );
    const o = new THREE.Object3D();
    for (let i = 0; i < 65; i++) {
      const f = track.frame((i / 65) * track.length);
      o.position.copy(f.pos);
      o.position.y = (f.pos.y - 13) / 2 - 13;
      o.scale.set(2, f.pos.y + 13, 2);
      o.updateMatrix();
      supports.setMatrixAt(i, o.matrix);
    }
    supports.castShadow = true;
    this.root.add(supports);
  }
  gate(s, text, color) {
    const f = this.track.frame(s),
      group = new THREE.Group(),
      w = this.track.width + 3,
      mat = new THREE.MeshStandardMaterial({
        color: "#202a2d",
        metalness: 0.6,
        roughness: 0.4,
      }),
      glow = new THREE.MeshBasicMaterial({ color });
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8, 1.1), mat);
      leg.position.set((side * w) / 2, 4, 0);
      group.add(leg);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.15, 7, 0.1), glow);
      led.position.set(side * (w / 2 - 0.42), 4, -0.57);
      group.add(led);
    }
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, 1.8, 0.8), mat);
    board.position.y = 8;
    group.add(board);
    for (const z of [-0.42, 0.42]) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(w - 1, 1.5),
        new THREE.MeshBasicMaterial({
          map: labelTexture(text, "#192124", color),
          side: THREE.FrontSide,
        }),
      );
      sign.position.set(0, 8, z);
      if (z < 0) sign.rotation.y = Math.PI;
      group.add(sign);
    }
    group.position.copy(f.pos);
    group.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(f.right, f.up, f.forward),
    );
    this.root.add(group);
  }
  pad(s, text, color, length, checker = false) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 512, 256);
    if (checker) {
      for (let x = 0; x < 16; x++)
        for (let y = 0; y < 4; y++) {
          ctx.fillStyle = (x + y) % 2 ? "#161a1b" : "#e6e2d9";
          ctx.fillRect(x * 32, y * 64, 32, 64);
        }
    } else {
      ctx.fillStyle = "#172426";
      ctx.font = "bold 130px Arial";
      ctx.textAlign = "center";
      ctx.fillText(text, 256, 170);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.track.width * 0.88, length),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
    );
    const f = this.track.frame(s);
    mesh.position.copy(f.pos).addScaledVector(f.up, 0.08);
    mesh.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(f.right, f.up, f.forward),
    );
    mesh.rotateX(-Math.PI / 2);
    this.root.add(mesh);
  }
  scenery(track) {
    const c = track.config,
      rand = seeded(c.seed),
      object = new THREE.Object3D();
    const city = ["neon", "cyber", "factory", "space"].includes(c.id),
      forest = ["forest", "island", "coast"].includes(c.id),
      count = city ? 145 : 180;
    const geo = city
        ? new THREE.BoxGeometry(1, 1, 1)
        : new THREE.DodecahedronGeometry(1, 0),
      material = new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 0.95,
        flatShading: true,
      });
    const rocks = new THREE.InstancedMesh(geo, material, count);
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    const lights = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.035, 1),
      new THREE.MeshBasicMaterial({ color: c.color }),
      city ? count : 1,
    );
    for (let i = 0; i < count; i++) {
      const s = rand() * track.length,
        f = track.frame(s),
        side = rand() > 0.5 ? 1 : -1,
        d = track.width / 2 + 15 + Math.pow(rand(), 0.65) * 340;
      object.position.copy(f.pos).addScaledVector(f.right, d * side);
      let sx = 10 + rand() * 30,
        sy = city ? 25 + rand() * 110 : 12 + rand() * 65,
        sz = 10 + rand() * 35;
      for (let tries = 0; tries < 16; tries++) {
        let nearest = Infinity;
        for (let j = 0; j < track.frames.length; j += 18) {
          const p = track.frames[j].pos;
          nearest = Math.min(
            nearest,
            Math.hypot(p.x - object.position.x, p.z - object.position.z),
          );
        }
        if (nearest > track.width / 2 + Math.max(sx, sz) * 1.25 + 9) break;
        object.position.addScaledVector(f.right, side * 40);
      }
      object.position.y = -13 + sy * 0.42;
      object.scale.set(sx, sy, sz);
      object.rotation.set(
        city ? 0 : rand() * 0.3,
        rand() * 3,
        city ? 0 : rand() * 0.2,
      );
      object.updateMatrix();
      rocks.setMatrixAt(i, object.matrix);
      if (city) {
        object.position.y += sy * 0.45;
        object.scale.y = 80;
        object.updateMatrix();
        lights.setMatrixAt(i, object.matrix);
      }
      rocks.setColorAt(
        i,
        new THREE.Color(c.rock).multiplyScalar(0.75 + rand() * 0.5),
      );
    }
    this.root.add(rocks);
    if (city) this.root.add(lights);
    if (forest || c.id === "snow") {
      const trees = new THREE.InstancedMesh(
        new THREE.ConeGeometry(1, 1, 7),
        new THREE.MeshStandardMaterial({
          color: c.id === "snow" ? "#dce7e8" : "#275946",
          flatShading: true,
        }),
        240,
      );
      for (let i = 0; i < 240; i++) {
        const f = track.frame(rand() * track.length);
        object.position
          .copy(f.pos)
          .addScaledVector(
            f.right,
            (rand() > 0.5 ? 1 : -1) * (track.width / 2 + 10 + rand() * 110),
          );
        object.position.y = -5 + rand() * 4;
        object.scale.set(3 + rand() * 5, 14 + rand() * 14, 3 + rand() * 5);
        object.rotation.set(0, rand() * 6, 0);
        object.updateMatrix();
        trees.setMatrixAt(i, object.matrix);
      }
      trees.castShadow = true;
      this.root.add(trees);
    }
    if (c.id === "island" || c.id === "coast") {
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(4000, 4000),
        new THREE.MeshStandardMaterial({
          color: "#267f91",
          metalness: 0.5,
          roughness: 0.22,
          transparent: true,
          opacity: 0.88,
        }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = -10;
      this.root.add(water);
      this.water = water;
    }
    if (c.id === "volcano") {
      const lava = new THREE.Mesh(
        new THREE.PlaneGeometry(4000, 4000),
        new THREE.MeshBasicMaterial({ color: "#e94917" }),
      );
      lava.rotation.x = -Math.PI / 2;
      lava.position.y = -11;
      this.root.add(lava);
    }
    const flagMat = new THREE.MeshBasicMaterial({
      map: labelTexture("A // S", c.color, "#172022", 256, 512),
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 20; i++) {
      const f = track.frame((i / 20) * track.length),
        flag = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 10), flagMat);
      flag.position
        .copy(f.pos)
        .addScaledVector(f.right, track.width / 2 + 4)
        .addScaledVector(f.up, 6);
      flag.rotation.y = Math.atan2(f.forward.x, f.forward.z);
      this.root.add(flag);
    }
    for (let i = 0; i < 9; i++) {
      const s = (0.34 + i * 0.009) * track.length,
        f = track.frame(s),
        tunnel = c.id === "factory" || c.id === "space" || c.id === "cyber";
      if (!tunnel && i > 2) continue;
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(track.width * 0.62, 0.42, 5, 20, Math.PI),
        new THREE.MeshStandardMaterial({
          color: tunnel ? c.color : "#485f63",
          metalness: 0.5,
          roughness: 0.4,
        }),
      );
      arch.position.copy(f.pos);
      arch.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(f.right, f.up, f.forward),
      );
      this.root.add(arch);
    }
    this.orbit = new THREE.Group();
    this.orbit.position.set(150, 160, -250);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(30 + i * 8, 0.5, 5, 64),
        new THREE.MeshBasicMaterial({ color: c.color }),
      );
      ring.rotation.x = i * 0.7;
      this.orbit.add(ring);
    }
    this.orbit.visible = c.id === "space";
    this.root.add(this.orbit);
  }
  orient(mesh, frame, heading) {
    const basis = new THREE.Matrix4().makeBasis(
      frame.right,
      frame.up,
      frame.forward,
    );
    mesh.quaternion.setFromRotationMatrix(basis);
    mesh.rotateY(heading);
  }
  setRacers(racers, ghostVehicle) {
    this.hero.visible = false;
    this.cars = racers.map((r) => {
      const m = createVehicle(r.vehicle, r.color);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: labelTexture(r.name, "#152024", r.color, 512, 100),
          depthTest: false,
          transparent: true,
          opacity: 0.9,
        }),
      );
      sprite.position.set(0, 3.3, 0);
      sprite.scale.set(4.3, 0.84, 1);
      m.add(sprite);
      m.userData.label = sprite;
      this.root.add(m);
      return m;
    });
    if (ghostVehicle) {
      this.ghost = createVehicle(ghostVehicle, "#8cf6ff", true);
      this.root.add(this.ghost);
    } else this.ghost = null;
    this.cameraReady = false;
  }
  updateCars(racers, dt) {
    racers.forEach((r, i) => {
      const car = this.cars[i],
        f = this.track.frame(r.s);
      car.position
        .copy(f.pos)
        .addScaledVector(f.right, r.lateral)
        .addScaledVector(
          f.up,
          r.height + 0.08 + (r.height < 0.01 ? this.track.rampHeight(r.s) : 0),
        );
      this.orient(car, f, r.heading);
      car.rotateZ(-r.heading * 0.09);
      car.rotateX(Math.min(0.25, r.verticalSpeed * 0.013));
      if (this.settings.effects && r.drifting && r.height < 0.1) {
        for (const side of [-1, 1]) {
          const a = this.track.world(r.s - 1.7, r.lateral + side * 1.1, 0.09),
            b = this.track.world(
              r.s - 1.7 - r.speed * dt,
              r.lateral + side * 1.1,
              0.09,
            );
          this.skidPositions.set(a.toArray(), this.skidIndex * 3);
          this.skidPositions.set(b.toArray(), (this.skidIndex + 1) * 3);
          this.skidIndex = (this.skidIndex + 2) % 3000;
        }
        this.skidGeo.attributes.position.needsUpdate = true;
      }
      car.userData.wheels.forEach((w) => {
        w.children.forEach((m) => (m.rotation.x += (r.speed * dt) / 0.59));
        if (w.position.z > 0) w.rotation.y = r.heading * 0.5;
      });
      car.userData.flames.forEach((flame) => {
        flame.visible = r.boosting;
        flame.scale.y = 0.7 + Math.random() * 0.8;
      });
      if (
        this.settings.effects &&
        (r.drifting || r.offTime > 0 || r.boosting) &&
        r.speed > 10 &&
        this.particles.length < 310
      ) {
        this.particles.push({
          p: car.position.clone().addScaledVector(f.forward, -2.8),
          life: 1,
          velocity: f.right
            .clone()
            .multiplyScalar((Math.random() - 0.5) * 4)
            .addScaledVector(f.up, 1.7),
        });
      }
    });
  }
  updateGhost(sample) {
    if (!this.ghost) return;
    this.ghost.visible = !!sample;
    if (sample) {
      const f = this.track.frame(sample.s);
      this.ghost.position
        .copy(f.pos)
        .addScaledVector(f.right, sample.lateral)
        .addScaledVector(f.up, sample.height + 0.1);
      this.orient(this.ghost, f, sample.heading);
    }
  }
  updateEffects(dt) {
    this.clock += dt;
    if (this.orbit) this.orbit.rotation.y += dt * 0.15;
    this.particles = this.particles.filter((p) => p.life > 0);
    this.particlePositions.fill(-9999);
    this.particles.forEach((p, i) => {
      p.life -= dt;
      p.p.addScaledVector(p.velocity, dt);
      this.particlePositions.set(p.p.toArray(), i * 3);
    });
    this.particleGeo.attributes.position.needsUpdate = true;
    this.particleMesh.visible = this.settings.effects;
    if (this.weatherMesh?.visible) {
      for (let i = 1; i < this.weatherPositions.length; i += 3) {
        this.weatherPositions[i] -= dt * (this.weather === "snow" ? 5 : 55);
        if (this.weatherPositions[i] < 0) this.weatherPositions[i] = 90;
      }
      this.weatherGeo.attributes.position.needsUpdate = true;
      this.weatherMesh.position.copy(this.cameras[0].position);
      this.weatherMesh.position.y = 0;
    }
  }
  renderMenu(dt, garage = false) {
    this.updateEffects(dt);
    const cam = this.cameras[0],
      f = this.track.frame(14);
    this.hero.visible = true;
    const angle = garage
      ? this.clock * 0.17
      : Math.sin(this.clock * 0.12) * 0.055;
    const side = garage ? Math.cos(angle) * 10 : 10;
    const front = garage ? Math.sin(angle) * 10 : 12;
    const target = this.hero.position
      .clone()
      .addScaledVector(f.right, garage ? 0 : -4.6)
      .addScaledVector(f.up, 1.5);
    const position = this.hero.position
      .clone()
      .addScaledVector(f.right, side)
      .addScaledVector(f.forward, front)
      .addScaledVector(f.up, garage ? 4.8 : 4.8);
    cam.position.copy(position);
    cam.lookAt(target);
    cam.fov = garage ? 43 : 49;
    cam.aspect = this.width / this.height;
    cam.updateProjectionMatrix();
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, this.width, this.height);
    this.renderer.render(this.scene, cam);
  }
  renderRace(racers, humans, dt, finished = false) {
    this.updateCars(racers, dt);
    this.updateEffects(dt);
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, this.width, this.height);
    this.renderer.clear();
    this.renderer.setScissorTest(true);
    for (let i = 0; i < humans; i++) {
      this.cars.forEach((c, j) => {
        c.userData.label.visible = j !== i;
      });
      const r = racers[i],
        car = this.cars[i],
        cam = this.cameras[i],
        f = this.track.frame(r.s);
      const cols = humans === 1 ? 1 : 2,
        rows = humans > 2 ? 2 : 1,
        w = this.width / cols,
        h = this.height / rows,
        x = (i % cols) * w,
        y = this.height - (Math.floor(i / cols) + 1) * h;
      const mode = this.settings.camera,
        dist = mode === "close" ? 8 : mode === "far" ? 18 : 9,
        height = mode === "close" ? 4 : mode === "far" ? 7 : 3.7;
      const pos = car.position.clone();
      if (mode === "hood" && !finished)
        pos.addScaledVector(f.forward, 1.1).addScaledVector(f.up, 1.6);
      else
        pos
          .addScaledVector(
            f.forward,
            finished ? Math.cos(this.clock * 0.5) * 12 : -dist,
          )
          .addScaledVector(
            f.right,
            finished ? Math.sin(this.clock * 0.5) * 12 : r.heading * -2,
          )
          .addScaledVector(f.up, finished ? 5 : height);
      if (!this.cameraReady) cam.position.copy(pos);
      else
        cam.position.lerp(pos, 1 - Math.exp(-dt * (mode === "hood" ? 35 : 8)));
      if (this.settings.shake && r.shake > 0)
        cam.position.add(
          new THREE.Vector3(
            (Math.random() - 0.5) * r.shake,
            (Math.random() - 0.5) * r.shake,
            0,
          ),
        );
      cam.up.lerp(f.up, 0.1);
      cam.lookAt(
        car.position
          .clone()
          .addScaledVector(f.forward, finished ? 0 : mode === "hood" ? 35 : 8)
          .addScaledVector(f.up, 1.3),
      );
      cam.fov = lerp(
        cam.fov,
        (mode === "hood" ? 76 : 60) +
          (this.settings.motion ? r.speed * 0.13 : 0),
        0.08,
      );
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      this.renderer.setViewport(x, y, w, h);
      this.renderer.setScissor(x, y, w, h);
      this.renderer.render(this.scene, cam);
    }
    this.cameraReady = true;
    this.renderer.setScissorTest(false);
  }
  setHero(vehicle) {
    this.root.remove(this.hero);
    this.hero.traverse((o) => {
      o.geometry?.dispose();
      if (o.material)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
    });
    this.hero = createVehicle(vehicle);
    this.root.add(this.hero);
    this.hero.position.copy(this.track.world(14, -1, 0.15));
    this.orient(this.hero, this.track.frame(14), 0);
  }
}
