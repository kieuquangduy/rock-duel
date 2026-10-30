import * as THREE from 'three';

/**
 * Creates a rugged tactical cover boulder.
 * Mathematically guaranteed to block line of sight when crouching neutral:
 * - Base sits firmly on ground (Y = 0)
 * - Center top reaches Y = 1.42m (higher than camera eye level 1.10m)
 * - Width spans -1.25m to +1.25m (2.5m wide)
 * - Deep faceted low-poly stone aesthetic
 */
export function createProceduralRock(seed = 1) {
  // Use Cylinder or Box base subdivided for solid coverage
  const geometry = new THREE.CylinderGeometry(1.05, 1.35, 1.45, 16, 6);
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();

  const pseudoNoise = (x, y, z) => {
    return Math.sin(x * 2.8 + seed) * Math.cos(y * 2.2 + seed * 1.4) * Math.sin(z * 3.1 + seed * 2.1);
  };

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);

    // Shift geometry so base sits at Y = 0
    v.y += 1.45 / 2;

    // Organic displacement
    const noise = 0.12 * pseudoNoise(v.x, v.y, v.z);
    v.x += noise;
    v.z += noise;

    // Guarantee: Do NOT lower the center top ridge!
    // Center top must stay at least 1.40m to conceal player's camera at 1.10m
    if (v.y > 1.3) {
      v.y = Math.max(1.40, v.y + noise * 0.5);
    }

    // Widen horizontally slightly for broader shoulder cover
    v.x *= 1.2;

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geometry.computeVertexNormals();

  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x825336, // Earthy desert sandstone
    roughness: 0.92,
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

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0a080, roughness: 0.5 });
  const darkClothMat = new THREE.MeshStandardMaterial({ color: 0x1f2a24, roughness: 0.7 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0x9e2a00, roughness: 0.6 }); // Crimson beret/helmet
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.9 });

  // 1. Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.7, 0.38), darkClothMat);
  torso.position.y = 0.75;
  torso.castShadow = true;
  group.add(torso);

  // 2. Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.35, 0);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Helmet
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    helmetMat
  );
  helmet.position.y = 0.05;
  headGroup.add(helmet);

  // Cyan Visor
  const goggles = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.08, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x00e1d9, roughness: 0.1, metalness: 0.8 })
  );
  goggles.position.set(0, 0.02, 0.2);
  headGroup.add(goggles);

  head.userData = { isHead: true, parentGroup: group };
  torso.userData = { isBody: true, parentGroup: group };
  group.add(headGroup);

  // 3. Opponent Sniper Rifle
  const rifleGroup = new THREE.Group();
  rifleGroup.position.set(0.22, 1.1, 0.25);

  const rifleBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.75), metalMat);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8), metalMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.75;
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 8), metalMat);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.1, 0.08);

  // Bright Yellow Scope Glint
  const glint = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 14),
    new THREE.MeshBasicMaterial({ color: 0xffea00, side: THREE.DoubleSide })
  );
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

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.55), woodStock);
  stock.position.set(0, -0.04, -0.2);
  rifle.add(stock);

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.4), darkGunMetal);
  receiver.position.set(0, 0, 0.22);
  rifle.add(receiver);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 1.2, 10), darkGunMetal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, 0.85);
  rifle.add(barrel);

  const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.45, 12), darkGunMetal);
  scopeTube.rotation.x = Math.PI / 2;
  scopeTube.position.set(0, 0.14, 0.2);
  rifle.add(scopeTube);

  rifle.position.set(0.28, -0.28, -0.55);
  return rifle;
}

/**
 * Creates the Desert Canyon Arena Environment
 */
export function createDesertEnvironment(scene) {
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
