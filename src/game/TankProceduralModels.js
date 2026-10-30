import * as THREE from 'three';

/**
 * Procedural 3D Tank Model
 * Fully constructed using Three.js mathematical geometries:
 * - Sloped Hull with side skirts and engine deck
 * - Dual track assemblies with animated road wheels
 * - 360° Traversing Turret
 * - Elevating 120mm Gun with muzzle brake & bore evacuator
 * - Armor hitboxes: Front, Sides, Rear, Turret
 */
export function createProceduralTank(isOpponent = false) {
  const root = new THREE.Group();

  // Materials
  const baseColor = isOpponent ? 0x3d434a : 0x8a6e4b; // Opponent: Urban Steel Gray, Player: Desert Sand
  const secondaryColor = isOpponent ? 0x22262a : 0x5a462e;
  const treadColor = 0x1a1a1a;
  const metalDetail = 0x111111;

  const armorMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.65,
    metalness: 0.35,
    flatShading: true,
  });

  const darkArmorMat = new THREE.MeshStandardMaterial({
    color: secondaryColor,
    roughness: 0.7,
    metalness: 0.3,
    flatShading: true,
  });

  const treadMat = new THREE.MeshStandardMaterial({
    color: treadColor,
    roughness: 0.9,
    metalness: 0.2,
  });

  const wheelMat = new THREE.MeshStandardMaterial({
    color: metalDetail,
    roughness: 0.5,
    metalness: 0.6,
  });

  // 1. HULL GROUP
  const hullGroup = new THREE.Group();
  root.add(hullGroup);

  // Main Hull Chassis (angled lower & upper hull)
  const mainHull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 4.4), armorMat);
  mainHull.position.y = 0.75;
  mainHull.castShadow = true;
  mainHull.receiveShadow = true;
  hullGroup.add(mainHull);

  // Sloped Front Glacis Plate
  const glacis = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.5, 1.2), armorMat);
  glacis.position.set(0, 0.9, 1.8);
  glacis.rotation.x = -Math.PI / 6;
  glacis.castShadow = true;
  hullGroup.add(glacis);

  // Rear Engine Deck
  const engineDeck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 1.5), darkArmorMat);
  engineDeck.position.set(0, 1.15, -1.3);
  engineDeck.castShadow = true;
  hullGroup.add(engineDeck);

  // Exhaust vents & radiator grilles
  const exhaustL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), wheelMat);
  exhaustL.rotation.x = Math.PI / 2;
  exhaustL.position.set(-0.9, 1.05, -2.25);
  hullGroup.add(exhaustL);

  const exhaustR = exhaustL.clone();
  exhaustR.position.x = 0.9;
  hullGroup.add(exhaustR);

  // 2. TRACKS & WHEELS (Left & Right)
  const wheels = [];
  const createTrackAssembly = (sideX) => {
    const trackGroup = new THREE.Group();
    trackGroup.position.x = sideX;

    // Track belt outer mesh
    const trackBelt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 4.8), treadMat);
    trackBelt.position.y = 0.45;
    trackBelt.castShadow = true;
    trackGroup.add(trackBelt);

    // Side armor skirt plate
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 4.6), armorMat);
    skirt.position.set(sideX > 0 ? 0.32 : -0.32, 0.55, 0);
    skirt.castShadow = true;
    trackGroup.add(skirt);

    // 5 Road wheels per side
    for (let i = 0; i < 5; i++) {
      const zPos = -1.8 + i * 0.9;
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.45, 12), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.42, zPos);
      wheel.castShadow = true;
      trackGroup.add(wheel);
      wheels.push(wheel);
    }

    // Drive sprocket (rear) & Idler (front)
    const sprocket = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.45, 10), wheelMat);
    sprocket.rotation.z = Math.PI / 2;
    sprocket.position.set(0, 0.62, -2.15);
    trackGroup.add(sprocket);
    wheels.push(sprocket);

    const idler = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.45, 10), wheelMat);
    idler.rotation.z = Math.PI / 2;
    idler.position.set(0, 0.62, 2.15);
    trackGroup.add(idler);
    wheels.push(idler);

    return trackGroup;
  };

  hullGroup.add(createTrackAssembly(1.45));
  hullGroup.add(createTrackAssembly(-1.45));

  // Front Headlights
  const headlightMat = new THREE.MeshBasicMaterial({ color: isOpponent ? 0xff4444 : 0xffffaa });
  const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.1), headlightMat);
  lightL.position.set(-0.95, 1.05, 2.2);
  hullGroup.add(lightL);

  const lightR = lightL.clone();
  lightR.position.x = 0.95;
  hullGroup.add(lightR);

  // 3. TURRET GROUP (Rotates 360° around Y)
  const turretGroup = new THREE.Group();
  turretGroup.position.set(0, 1.25, 0.1);
  hullGroup.add(turretGroup);

  // Turret Ring Base
  const turretRing = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.1, 0.2, 16), darkArmorMat);
  turretRing.position.y = 0.1;
  turretGroup.add(turretRing);

  // Turret Main Body (Angular modern MBT design)
  const turretBody = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 2.5), armorMat);
  turretBody.position.set(0, 0.45, -0.15);
  turretBody.castShadow = true;
  turretGroup.add(turretBody);

  // Turret Angled Cheeks (Front Armor Wedges)
  const cheekL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 1.4), armorMat);
  cheekL.position.set(-0.95, 0.45, 0.4);
  cheekL.rotation.y = -Math.PI / 10;
  cheekL.castShadow = true;
  turretGroup.add(cheekL);

  const cheekR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 1.4), armorMat);
  cheekR.position.set(0.95, 0.45, 0.4);
  cheekR.rotation.y = Math.PI / 10;
  cheekR.castShadow = true;
  turretGroup.add(cheekR);

  // Commander Cupola & Hatch
  const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.25, 10), darkArmorMat);
  cupola.position.set(0.5, 0.85, -0.3);
  turretGroup.add(cupola);

  // Antenna
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 1.6, 4), wheelMat);
  antenna.position.set(-0.7, 1.55, -1.0);
  turretGroup.add(antenna);

  // 4. CANNON BARREL GROUP (Pivots Pitch up/down)
  const barrelGroup = new THREE.Group();
  barrelGroup.position.set(0, 0.45, 1.15);
  turretGroup.add(barrelGroup);

  // Gun Mantlet
  const mantlet = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.45), darkArmorMat);
  mantlet.castShadow = true;
  barrelGroup.add(mantlet);

  // Long 120mm Gun Barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 4.2, 12), wheelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, 2.1);
  barrel.castShadow = true;
  barrelGroup.add(barrel);

  // Bore Evacuator / Fume Extractor collar
  const fumeExtractor = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.65, 12), armorMat);
  fumeExtractor.rotation.x = Math.PI / 2;
  fumeExtractor.position.set(0, 0, 2.5);
  barrelGroup.add(fumeExtractor);

  // Double-Baffle Muzzle Brake
  const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.45), wheelMat);
  muzzleBrake.position.set(0, 0, 4.3);
  barrelGroup.add(muzzleBrake);

  // Muzzle Flash Light & Mesh (Glows when fired)
  const muzzleLight = new THREE.PointLight(0xff7700, 0, 18);
  muzzleLight.position.set(0, 0, 4.8);
  barrelGroup.add(muzzleLight);

  const muzzleFlash = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.45),
    new THREE.MeshBasicMaterial({ color: 0xffea55, transparent: true, opacity: 0 })
  );
  muzzleFlash.position.set(0, 0, 4.8);
  barrelGroup.add(muzzleFlash);

  // 5. HITBOXES FOR ARMOR DAMAGE
  // Attach metadata tags for localized damage calculation
  mainHull.userData = { part: 'HULL_SIDE', tankGroup: root };
  glacis.userData = { part: 'FRONT_ARMOR', tankGroup: root };
  engineDeck.userData = { part: 'REAR_WEAKSPOT', tankGroup: root };
  turretBody.userData = { part: 'TURRET', tankGroup: root };
  mantlet.userData = { part: 'MANTLET', tankGroup: root };

  return {
    root,
    hullGroup,
    turretGroup,
    barrelGroup,
    wheels,
    muzzleLight,
    muzzleFlash,
    mainHull,
    glacis,
    engineDeck,
    turretBody,
    mantlet,
  };
}

/**
 * Procedural Tank Battlefield Environment
 * Includes:
 * - Rough terrain ground with crater displacement
 * - Concrete Dragon's Teeth (Anti-Tank Obstacles)
 * - Steel Anti-Tank Hedgehogs
 * - Ruined Brick Defensive Walls (Cover)
 * - Tactical Boulders
 * - Natural perimeter cliffs
 */
export function createTankBattlefield(scene, arenaRadius = 90) {
  const obstacles = []; // Objects with bounding boxes for collision

  // 1. Terrain Ground
  const groundGeo = new THREE.PlaneGeometry(arenaRadius * 2.5, arenaRadius * 2.5, 40, 40);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Subtle undulation
    const elevation = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 0.75 + Math.sin(x * 0.02 + y * 0.02) * 1.2;
    pos.setZ(i, elevation);
  }
  groundGeo.computeVertexNormals();

  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x98714b, // Warm dirt/sand
    roughness: 0.95,
    metalness: 0.05,
    flatShading: true,
  });

  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // 2. Defensive Ruined Walls (Tactical Hull-Down Cover)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x6e5845, roughness: 0.9, flatShading: true });
  const wallPositions = [
    { x: -15, z: 0, rot: 0.1, length: 12 },
    { x: 15, z: 0, rot: -0.2, length: 12 },
    { x: 0, z: -25, rot: Math.PI / 2, length: 16 },
    { x: 0, z: 25, rot: Math.PI / 2, length: 16 },
    { x: -28, z: -18, rot: 0.6, length: 10 },
    { x: 28, z: 18, rot: -0.5, length: 10 },
  ];

  wallPositions.forEach((wp) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(wp.length, 1.8, 1.2), wallMat);
    wall.position.set(wp.x, 0.9, wp.z);
    wall.rotation.y = wp.rot;
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);

    wall.geometry.computeBoundingBox();
    obstacles.push({
      mesh: wall,
      radius: wp.length * 0.5,
      type: 'WALL',
      pos: new THREE.Vector2(wp.x, wp.z),
    });
  });

  // 3. Concrete Dragon's Teeth (Anti-Tank Pyramids)
  const toothMat = new THREE.MeshStandardMaterial({ color: 0x777065, roughness: 0.92, flatShading: true });
  const toothGeo = new THREE.ConeGeometry(1.1, 1.6, 4);

  const toothClusters = [
    { cx: -8, cz: 12 },
    { cx: 8, cz: -12 },
    { cx: -22, cz: 14 },
    { cx: 22, cz: -14 },
  ];

  toothClusters.forEach((cl) => {
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const tooth = new THREE.Mesh(toothGeo, toothMat);
        const px = cl.cx + c * 2.2;
        const pz = cl.cz + r * 2.2;
        tooth.position.set(px, 0.8, pz);
        tooth.rotation.y = Math.PI / 4;
        tooth.castShadow = true;
        scene.add(tooth);

        obstacles.push({
          mesh: tooth,
          radius: 1.2,
          type: 'TOOTH',
          pos: new THREE.Vector2(px, pz),
        });
      }
    }
  });

  // 4. Tactical Large Boulders
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x734c32, roughness: 0.95, flatShading: true });
  const boulderCoords = [
    { x: -32, z: 0, s: 3.5 },
    { x: 32, z: 0, s: 3.8 },
    { x: -18, z: -35, s: 4.0 },
    { x: 18, z: 35, s: 4.2 },
    { x: 0, z: 0, s: 3.0 }, // Center pillar
  ];

  boulderCoords.forEach((b) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(b.s, 1), rockMat);
    rock.position.set(b.x, b.s * 0.6, b.z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);

    obstacles.push({
      mesh: rock,
      radius: b.s * 0.9,
      type: 'ROCK',
      pos: new THREE.Vector2(b.x, b.z),
    });
  });

  // 5. Perimeter Canyon Outcrops (Border walls)
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2;
    const dist = arenaRadius - 4;
    const w = 18 + (i % 3) * 6;
    const h = 20 + (i % 4) * 8;
    const canyon = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.6, w, h, 6),
      new THREE.MeshStandardMaterial({ color: 0x653b26, roughness: 0.95, flatShading: true })
    );
    canyon.position.set(Math.cos(angle) * dist, h * 0.5, Math.sin(angle) * dist);
    scene.add(canyon);
  }

  return { ground, obstacles, arenaRadius };
}
