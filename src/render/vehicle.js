import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
export function createVehicle(config, color = config.color, ghost = false) {
  const car = new THREE.Group(),
    shape = config.shape || 0;
  const paint = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.38,
    roughness: 0.27,
    clearcoat: 1,
    clearcoatRoughness: 0.18,
    transparent: ghost,
    opacity: ghost ? 0.28 : 1,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#111a20",
    metalness: 0.4,
    roughness: 0.44,
    transparent: ghost,
    opacity: ghost ? 0.2 : 1,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#284756",
    metalness: 0.72,
    roughness: 0.13,
    clearcoat: 1,
    transparent: ghost,
    opacity: ghost ? 0.2 : 1,
  });
  const light = new THREE.MeshBasicMaterial({
    color: "#d8fbff",
    toneMapped: false,
    transparent: ghost,
    opacity: ghost ? 0.3 : 1,
  });
  const tail = new THREE.MeshBasicMaterial({
    color: "#ff4529",
    toneMapped: false,
    transparent: ghost,
    opacity: ghost ? 0.3 : 1,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: "#b6c4cb",
    metalness: 0.85,
    roughness: 0.22,
    transparent: ghost,
    opacity: ghost ? 0.3 : 1,
  });
  function box(w, h, d, x, y, z, mat = paint) {
    const m = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 2, Math.min(0.055, h * 0.22)),
      mat,
    );
    m.position.set(x, y, z);
    m.castShadow = !ghost;
    m.receiveShadow = true;
    car.add(m);
    return m;
  }
  function hull(sections, mat) {
    const verts = [],
      idx = [];
    for (const [z, w, lo, hi] of sections)
      verts.push(-w, lo, z, w, lo, z, -w, hi, z, w, hi, z);
    for (let i = 0; i < sections.length - 1; i++) {
      const a = i * 4,
        b = a + 4;
      idx.push(
        a,
        b,
        a + 1,
        a + 1,
        b,
        b + 1,
        a + 2,
        a + 3,
        b + 2,
        a + 3,
        b + 3,
        b + 2,
        a,
        a + 2,
        b,
        a + 2,
        b + 2,
        b,
        a + 1,
        b + 1,
        a + 3,
        a + 3,
        b + 1,
        b + 3,
      );
    }
    idx.push(0, 1, 2, 1, 3, 2);
    const e = (sections.length - 1) * 4;
    idx.push(e, e + 2, e + 1, e + 1, e + 2, e + 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = !ghost;
    m.receiveShadow = true;
    car.add(m);
    return m;
  }
  hull(
    [
      [2.6, 1.12, 0.39, 0.72],
      [1.8, 1.28, 0.4, 0.93],
      [0.6, 1.25, 0.44, 0.96],
      [-1.65, 1.3, 0.42, 1.0],
      [-2.5, 1.18, 0.42, 0.85],
    ],
    paint,
  );
  box(2.46, 0.14, 5.35, 0, 0.36, 0, dark);
  // A tapered cabin gives the original coupe a raked windscreen and fastback profile.
  const cabinVerts = [
    -1.0, 0.98, 1.05, 1.0, 0.98, 1.05, -0.76, 1.59, 0.05, 0.76, 1.59, 0.05,
    -1.01, 1.02, -1.68, 1.01, 1.02, -1.68, -0.79, 1.63, -0.92, 0.79, 1.63,
    -0.92,
  ];
  const cg = new THREE.BufferGeometry();
  cg.setAttribute("position", new THREE.Float32BufferAttribute(cabinVerts, 3));
  cg.setIndex([
    0, 1, 2, 1, 3, 2, 2, 3, 6, 3, 7, 6, 4, 6, 5, 5, 6, 7, 0, 2, 4, 2, 6, 4, 1,
    5, 3, 3, 5, 7,
  ]);
  cg.computeVertexNormals();
  car.add(new THREE.Mesh(cg, glass));
  const roof = box(1.59, 0.075, 1.06, 0, 1.637, -0.48);
  roof.rotation.x = -0.035;
  for (const x of [-1, 1]) {
    const pillar = box(0.1, 0.065, 1.17, x * 0.89, 1.3, 0.56);
    pillar.rotation.x = 0.56;
    pillar.rotation.z = x * 0.19;
    box(0.15, 0.065, 1.55, x * 0.99, 1.05, -0.43);
    box(0.19, 0.09, 1.45, x * 0.44, 1.001, 1.72, dark);
    box(0.98, 0.08, 0.07, x * 0.68, 0.79, 2.48, light);
    box(0.69, 0.065, 0.08, x * 0.79, 0.83, -2.48, tail);
    box(0.43, 0.15, 0.12, x * 1.05, 0.54, 2.53, dark);
    box(0.17, 0.27, 0.6, x * 1.31, 0.61, -0.25, dark);
    for (let z = 0; z < 3; z++)
      box(0.025, 0.16, 0.035, x * 1.405, 0.63, -0.05 - z * 0.17, chrome);
    box(0.14, 0.08, 4.0, x * 1.25, 0.48, -0.1, dark);
    box(0.12, 0.42, 0.15, x * 0.91, 1.14, -2.16, dark);
  }
  box(2.95, 0.1, 0.47, 0, 1.4, -2.22, dark);
  box(2.74, 0.08, 0.44, 0, 0.39, 2.51, dark);
  box(2.48, 0.15, 0.45, 0, 0.43, -2.52, dark);
  for (const x of [-0.9, -0.45, 0, 0.45, 0.9])
    box(0.045, 0.2, 0.48, x, 0.37, -2.54, dark);
  const wheels = [];
  for (const x of [-1.26, 1.26])
    for (const z of [-1.62, 1.61]) {
      const wheel = new THREE.Group();
      wheel.position.set(x, 0.52, z);
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.53, 0.53, 0.39, 24),
        dark,
      );
      tire.rotation.z = Math.PI / 2;
      wheel.add(tire);
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.365, 0.365, 0.405, 20),
        chrome,
      );
      hub.rotation.z = Math.PI / 2;
      wheel.add(hub);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.29, 0.29, 0.412, 20),
        dark,
      );
      cap.rotation.z = Math.PI / 2;
      wheel.add(cap);
      for (let j = 0; j < 5; j++) {
        const spoke = new THREE.Mesh(
          new THREE.BoxGeometry(0.424, 0.055, 0.59),
          chrome,
        );
        spoke.rotation.x = (j * Math.PI) / 5;
        wheel.add(spoke);
      }
      const center = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.43, 12),
        paint,
      );
      center.rotation.z = Math.PI / 2;
      wheel.add(center);
      car.add(wheel);
      wheels.push(wheel);
      box(0.45, 0.12, 1.18, x, 0.98, z);
    }
  const flames = [];
  for (const x of [-0.67, 0.67]) {
    box(0.28, 0.18, 0.15, x, 0.56, -2.65, chrome);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.17, 1.6, 8),
      new THREE.MeshBasicMaterial({
        color: "#71dfff",
        toneMapped: false,
        transparent: true,
        opacity: 0.85,
      }),
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(x, 0.56, -3.4);
    flame.visible = false;
    car.add(flame);
    flames.push(flame);
  }
  if (shape === 1) {
    car.scale.set(1.04, 0.88, 1.16);
    box(1.9, 0.1, 0.7, 0, 1.01, -1.95);
  }
  if (shape === 2) {
    car.scale.set(0.92, 0.96, 0.87);
    box(0.18, 0.025, 1, 0, 1.68, -0.47, dark);
  }
  if (shape === 3) {
    car.scale.set(1.1, 1.2, 0.94);
    box(1.6, 0.2, 0.65, 0, 1.81, -0.55, dark);
    for (const x of [-0.55, 0.55]) box(0.4, 0.14, 0.12, x, 1.88, -0.15, light);
  }
  if (shape === 4) {
    car.scale.set(1.07, 0.72, 1.22);
    box(3.3, 0.1, 0.68, 0, 1.69, -2.32);
    box(0.09, 0.75, 0.15, -1.1, 1.3, -2.28, dark);
    box(0.09, 0.75, 0.15, 1.1, 1.3, -2.28, dark);
  }
  if (ghost)
    car.traverse((node) => {
      if (node.isMesh) {
        node.material.depthWrite = false;
        node.castShadow = false;
      }
    });
  car.userData = { wheels, flames };
  return car;
}
