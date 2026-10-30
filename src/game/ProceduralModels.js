import * as THREE from 'three';

/**
 * Creates a tactical boulder tailored for cover shooting.
 * Width ~2.4m, Height ~1.38m (just above eye level when crouching).
 */
export function createProceduralRock(width = 2.4, height = 1.38, depth = 1.8, seed = 1) {
  const geometry = new THREE.DodecahedronGeometry(1.2, 2);
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();

  const pseudoNoise = (x, y, z) => {
    return Math.sin(x * 3.0 + seed) * Math.cos(y * 2.5 + seed * 1.3) * Math.sin(z * 3.2 + seed * 2.1);
  };

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);

    // Scale to realistic cover dimensions
    v.x *= (width / 2.4);
    v.y *= (height / 1.38);
    v.z *= (depth / 1.8);

    // Organic displacement
    const displacement = 0.16 * pseudoNoise(v.x, v.y, v.z);
    v.addScaledVector(v.clone().normalize(), displacement);

    // Flatten base firmly onto the sand
    if (v.y < -0.5) {
      v.y = -0.5 + (v.y + 0.5) * 0.3;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geometry.computeVertexNormals();

  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a5a3a, // Desert sandstone
    roughness: 0.9,
    metalness: 0.05,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geometry, rockMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Creates the Opponent Avatar (Head, Helmet, Torso, Sniper Rifle with Glint)
 */
export function createOpponentAvatar() {
  const group = new THREE.Group();

  // Vibrant tactical materials so opponent is clearly visible at long distance
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0a080, roughness: 0.5 });
  const darkClothMat = new THREE.MeshStandardMaterial({ color: 0x1f2a24, roughness: 0.7 }); // Dark tactical outfit
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0x8b2500, roughness: 0.6 }); // Crimson sniper beret/helmet (High contrast against desert!)
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.9 });

  // 1. Torso
  const torsoGeo = new THREE.BoxGeometry(0.65, 0.75, 0.4);
  const torso = new THREE.Mesh(torsoGeo, darkClothMat);
  torso.position.y = 0.8;
  torso.castShadow = true;
  group.add(torso);

  // 2. Head Group (Rotates and leans)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.42, 0);

  // Head sphere
  const headGeo = new THREE.SphereGeometry(0.22, 14, 14);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Crimson Tactical Helmet / Beret (Easy to spot on opponent's rock!)
  const helmetGeo = new THREE.SphereGeometry(0.24, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const helmet = new THREE.Mesh(helmetGeo, helmetMat);
  helmet.position.y = 0.05;
  headGroup.add(helmet);

  // Goggles
  const goggles = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.08, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x00e1d9, roughness: 0.1, metalness: 0.8 }) // Cyan visor
  );
  goggles.position.set(0, 0.02, 0.2);
  headGroup.add(goggles);

  // Tag head & body for raycast hit detection
  head.userData = { isHead: true, parentGroup: group };
  torso.userData = { isBody: true, parentGroup: group };
  group.add(headGroup);

  // 3. Opponent's Sniper Rifle
  const rifleGroup = new THREE.Group();
  rifleGroup.position.set(0.22, 1.15, 0.25);

  const rifleBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.75), metalMat);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8), metalMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.75;
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 8), metalMat);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.1, 0.08);

  // Scope Glint (Bright yellow lens reflection when enemy is aiming)
  const glintGeo = new THREE.CircleGeometry(0.05, 12);
  const glintMat = new THREE.MeshBasicMaterial({
    color: 0xffea00,
    side: THREE.DoubleSide,
  });
  const glint = new THREE.Mesh(glintGeo, glintMat);
  glint.position.set(0, 0.1, 0.29);
  glint.visible = false;

  rifleGroup.add(rifleBody);
  rifleGroup.add(barrel);
  rifleGroup.add(scope);
  rifleGroup.add(glint);
  group.add(rifleGroup);

  return {
    group,
    headGroup,
    rifleGroup,
    headMesh: head,
    torsoMesh: torso,
    glintMesh: glint,
  };
}

/**
 * Creates the First-Person viewmodel sniper rifle
 */
export function createFirstPersonRifle() {
  const rifle = new THREE.Group();

  const darkGunMetal = new THREE.MeshStandardMaterial({
    color: 0x181a1d,
    roughness: 0.35,
    metalness: 0.85,
  });
  const woodStock = new THREE.MeshStandardMaterial({
    color: 0x4a2e1b,
    roughness: 0.7,
    metalness: 0.1,
  });

  // Stock
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.55), woodStock);
  stock.position.set(0, -0.04, -0.2);
  rifle.add(stock);

  // Receiver
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.4), darkGunMetal);
  receiver.position.set(0, 0, 0.22);
  rifle.add(receiver);

  // Barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 1.2, 10), darkGunMetal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, 0.85);
  rifle.add(barrel);

  // Scope
  const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.45, 12), darkGunMetal);
  scopeTube.rotation.x = Math.PI / 2;
  scopeTube.position.set(0, 0.14, 0.2);
  rifle.add(scopeTube);

  // Default holding position in first-person (bottom-right)
  rifle.position.set(0.28, -0.28, -0.55);
  return rifle;
}

/**
 * Creates the Desert Canyon Arena Environment
 */
export function createDesertEnvironment(scene) {
  // Ground
  const groundGeo = new THREE.PlaneGeometry(250, 250, 30, 30);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xb58252,
    roughness: 0.95,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // Distant canyon rock silhouettes
  const canyonMat = new THREE.MeshStandardMaterial({ color: 0x7c4930, roughness: 0.95, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2;
    const dist = 70 + (i % 3) * 15;
    const w = 18 + (i % 4) * 8;
    const h = 25 + (i % 5) * 10;
    const canyon = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w, h, 6), canyonMat);
    canyon.position.set(Math.cos(angle) * dist, h / 2, Math.sin(angle) * dist);
    scene.add(canyon);
  }

  return { ground };
}
