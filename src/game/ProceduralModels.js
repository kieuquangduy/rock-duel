import * as THREE from 'three';

/**
 * Creates a rugged procedural rock with natural crevices and facets
 */
export function createProceduralRock(width = 3.8, height = 3.2, depth = 2.8, seed = 1) {
  // Use Dodecahedron or Icosahedron for natural faceted stone shape
  const geometry = new THREE.DodecahedronGeometry(1.9, 2);
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();

  // Pseudo-random noise function based on seed
  const pseudoNoise = (x, y, z) => {
    return Math.sin(x * 2.5 + seed) * Math.cos(y * 2.1 + seed * 1.5) * Math.sin(z * 2.8 + seed * 2.2);
  };

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    
    // Scale to dimensions
    v.x *= (width / 3.8);
    v.y *= (height / 3.2);
    v.z *= (depth / 2.8);

    // Apply organic vertex deformation
    const displacement = 0.22 * pseudoNoise(v.x, v.y, v.z) + 0.1 * Math.sin(v.y * 4.0 + seed);
    v.addScaledVector(v.clone().normalize(), displacement);

    // Flatten bottom slightly so it sits firmly on ground
    if (v.y < -0.8) {
      v.y = -0.8 + (v.y + 0.8) * 0.4;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geometry.computeVertexNormals();

  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x9e6843,
    roughness: 0.88,
    metalness: 0.05,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geometry, rockMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Creates the opponent avatar (Head, Helmet, Torso, Sniper Rifle)
 */
export function createOpponentAvatar() {
  const group = new THREE.Group();

  // Material palette
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd49b74, roughness: 0.6 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x3d4b38, roughness: 0.8 }); // Tactical Camo Green
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x242a22, roughness: 0.7 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, roughness: 0.3, metalness: 0.8 });
  const gogglesMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.2, metalness: 0.9 }); // Orange sniper lens

  // 1. Torso
  const torsoGeo = new THREE.BoxGeometry(0.7, 0.85, 0.45);
  const torso = new THREE.Mesh(torsoGeo, clothMat);
  torso.position.y = 0.85;
  torso.castShadow = true;
  group.add(torso);

  // Tactical Vest
  const vestGeo = new THREE.BoxGeometry(0.74, 0.6, 0.48);
  const vest = new THREE.Mesh(vestGeo, vestMat);
  vest.position.y = 0.85;
  vest.castShadow = true;
  group.add(vest);

  // 2. Head (Headshot target)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.5, 0);

  const headGeo = new THREE.SphereGeometry(0.24, 12, 12);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Tactical Helmet
  const helmetGeo = new THREE.SphereGeometry(0.26, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const helmet = new THREE.Mesh(helmetGeo, vestMat);
  helmet.position.y = 0.04;
  headGroup.add(helmet);

  // Sniper Goggles / Glasses
  const gogglesGeo = new THREE.BoxGeometry(0.28, 0.08, 0.12);
  const goggles = new THREE.Mesh(gogglesGeo, gogglesMat);
  goggles.position.set(0, 0.02, 0.22);
  headGroup.add(goggles);

  // Tag head for hit detection
  head.userData = { isHead: true, parentGroup: group };
  torso.userData = { isBody: true, parentGroup: group };
  group.add(headGroup);

  // 3. Opponent's Sniper Rifle
  const rifleGroup = new THREE.Group();
  rifleGroup.position.set(0.25, 1.25, 0.3);

  // Barrel & Body
  const rifleBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.8), metalMat);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8), metalMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.85;
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), metalMat);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.12, 0.1);

  rifleGroup.add(rifleBody);
  rifleGroup.add(barrel);
  rifleGroup.add(scope);
  group.add(rifleGroup);

  return {
    group,
    headGroup,
    rifleGroup,
    headMesh: head,
    torsoMesh: torso
  };
}

/**
 * Creates the First-Person viewmodel sniper rifle
 */
export function createFirstPersonRifle() {
  const rifle = new THREE.Group();

  const darkGunMetal = new THREE.MeshStandardMaterial({
    color: 0x1c1e22,
    roughness: 0.35,
    metalness: 0.85,
  });
  const woodStock = new THREE.MeshStandardMaterial({
    color: 0x5a3d28,
    roughness: 0.7,
    metalness: 0.1,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.3,
    metalness: 0.9,
  });

  // Stock
  const stockGeo = new THREE.BoxGeometry(0.08, 0.16, 0.6);
  const stock = new THREE.Mesh(stockGeo, woodStock);
  stock.position.set(0, -0.05, -0.2);
  rifle.add(stock);

  // Receiver
  const receiverGeo = new THREE.BoxGeometry(0.09, 0.14, 0.45);
  const receiver = new THREE.Mesh(receiverGeo, darkGunMetal);
  receiver.position.set(0, 0, 0.25);
  rifle.add(receiver);

  // Barrel
  const barrelGeo = new THREE.CylinderGeometry(0.025, 0.03, 1.3, 12);
  const barrel = new THREE.Mesh(barrelGeo, darkGunMetal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.04, 0.95);
  rifle.add(barrel);

  // Muzzle brake
  const muzzleGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.16, 10);
  const muzzle = new THREE.Mesh(muzzleGeo, darkGunMetal);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.04, 1.6);
  rifle.add(muzzle);

  // Scope
  const scopeMount = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.2), darkGunMetal);
  scopeMount.position.set(0, 0.1, 0.25);
  rifle.add(scopeMount);

  const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.55, 12), darkGunMetal);
  scopeTube.rotation.x = Math.PI / 2;
  scopeTube.position.set(0, 0.16, 0.25);
  rifle.add(scopeTube);

  // Scope lens (golden/amber coat)
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.046, 16),
    new THREE.MeshBasicMaterial({ color: 0xf39c12, side: THREE.DoubleSide })
  );
  lens.position.set(0, 0.16, 0.52);
  rifle.add(lens);

  // Bolt handle
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8), brassMat);
  bolt.rotation.z = Math.PI / 3;
  bolt.position.set(0.07, 0.06, 0.15);
  rifle.add(bolt);

  // Default holding position in first-person (bottom-right)
  rifle.position.set(0.32, -0.32, -0.6);
  rifle.rotation.y = 0.02;

  return rifle;
}

/**
 * Creates the Desert Canyon Arena Environment
 */
export function createDesertEnvironment(scene, mapDistance = 35) {
  // Ground
  const groundGeo = new THREE.PlaneGeometry(300, 300, 40, 40);
  
  // Slight elevation wave for desert dunes
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // don't distort right around the rocks
    const distToCenter = Math.sqrt(x * x + y * y);
    if (distToCenter > 15) {
      const z = Math.sin(x * 0.05) * Math.cos(y * 0.04) * 2.2;
      pos.setZ(i, z);
    }
  }
  groundGeo.computeVertexNormals();

  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xc49666,
    roughness: 0.95,
    metalness: 0.02,
  });

  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  // Distant canyon rock walls
  const canyonColor = 0xa36443;
  const canyonMat = new THREE.MeshStandardMaterial({ color: canyonColor, roughness: 0.9, flatShading: true });

  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const dist = 90 + (i % 3) * 25;
    const canyonWidth = 25 + (i % 4) * 10;
    const canyonHeight = 35 + (i % 5) * 15;
    
    const canyon = new THREE.Mesh(
      new THREE.CylinderGeometry(canyonWidth * 0.6, canyonWidth, canyonHeight, 6),
      canyonMat
    );
    canyon.position.set(Math.cos(angle) * dist, canyonHeight / 2 - 2, Math.sin(angle) * dist);
    canyon.rotation.y = angle + 0.3;
    scene.add(canyon);
  }

  // Floating dust particles
  const particleCount = 200;
  const particleGeo = new THREE.BufferGeometry();
  const particlePos = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    particlePos[i] = (Math.random() - 0.5) * 80;
    particlePos[i + 1] = Math.random() * 8 + 0.5;
    particlePos[i + 2] = (Math.random() - 0.5) * 80;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));

  const particleMat = new THREE.PointsMaterial({
    color: 0xf5d6a8,
    size: 0.12,
    transparent: true,
    opacity: 0.5,
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  return { ground, particles };
}
