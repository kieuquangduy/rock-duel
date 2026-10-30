import * as THREE from 'three';
import { createProceduralTank, createTankBattlefield } from './TankProceduralModels';
import { sounds } from '../audio/SoundEffects';

export class TankGameEngine {
  constructor(canvasContainer, options = {}) {
    this.container = canvasContainer;
    this.isBotMode = options.isBotMode ?? true;
    this.isHost = options.isHost ?? true;
    this.mapDistance = options.mapDistance || 50;

    // Callbacks to React HUD & Match Manager
    this.onHit = options.onHit || (() => {});
    this.onKill = options.onKill || (() => {});
    this.onPlayerHpChange = options.onPlayerHpChange || (() => {});
    this.onOpponentHpChange = options.onOpponentHpChange || (() => {});
    this.onReloadState = options.onReloadState || (() => {});
    this.onSpeedChange = options.onSpeedChange || (() => {});
    this.onAimState = options.onAimState || (() => {});
    this.onPointerLockChange = options.onPointerLockChange || (() => {});
    this.onShotFired = options.onShotFired || (() => {});

    // Tank Health
    this.maxHp = 1000;
    this.playerHp = 1000;
    this.opponentHp = 1000;
    this.isAlive = true;
    this.opponentAlive = true;

    // Firing & Reload
    this.canShoot = true;
    this.reloadTime = 3.0; // seconds
    this.reloadProgress = 1.0;
    this.isAiming = false; // ADS gunner scope
    this.isLocked = false;

    // Camera Trauma (Screen Shake)
    this.cameraTrauma = 0;

    // Movement & Driving Physics
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
    };

    // Calculate initial spawn positions based on Host / Client roles
    // Host / Player starts at South base (Z = +36), Client starts at North base (Z = -36)
    const isSouthSpawn = this.isHost;
    const startZ = isSouthSpawn ? 36 : -36;
    const oppStartZ = isSouthSpawn ? -36 : 36;
    const startFacing = isSouthSpawn ? 0 : Math.PI; // Facing towards opponent

    this.playerTankState = {
      pos: new THREE.Vector3(0, 0, startZ),
      hullRotY: startFacing,
      speed: 0,
      maxForwardSpeed: 13.5, // m/s (~48 km/h)
      maxReverseSpeed: 6.5,  // m/s (~23 km/h)
      accel: 14.0,
      brake: 22.0,
      turnSpeed: 1.85,       // rad/s
      turretYaw: startFacing,
      targetTurretYaw: startFacing,
      cannonPitch: 0,
    };

    // Camera angles
    this.camYaw = startFacing;
    this.camPitch = 0.20;
    this.mouseSensitivity = 0.0024;

    // Opponent Remote State for Interpolation
    this.opponentRemoteState = {
      pos: new THREE.Vector3(0, 0, oppStartZ),
      hullRotY: isSouthSpawn ? Math.PI : 0,
      speed: 0,
      turretYaw: isSouthSpawn ? Math.PI : 0,
      cannonPitch: 0,
    };

    // Active Projectiles & Visual Effects
    this.shells = [];
    this.effects = [];
    this.scorchMarks = [];

    // Bot AI state
    this.botState = {
      moveTimer: 2.0,
      shootTimer: 2.8,
      strafeDir: 1,
    };

    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();

    this.initScene();
    this.initListeners();
    this.startLoop();
  }

  initScene() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.style.cursor = 'none';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd2b18a); // Warm desert horizon
    this.scene.fog = new THREE.FogExp2(0xd2b18a, 0.0065);

    this.camera = new THREE.PerspectiveCamera(
      65,
      this.container.clientWidth / this.container.clientHeight,
      0.2,
      450
    );

    // Lighting
    const ambient = new THREE.AmbientLight(0xfff6ea, 0.75);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfffaee, 1.9);
    sun.position.set(40, 65, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 200;
    const shadowSize = 70;
    sun.shadow.camera.left = -shadowSize;
    sun.shadow.camera.right = shadowSize;
    sun.shadow.camera.top = shadowSize;
    sun.shadow.camera.bottom = -shadowSize;
    this.scene.add(sun);

    // Battlefield Terrain & Obstacles
    this.battlefield = createTankBattlefield(this.scene, 75);

    // Player Tank (Desert Tan Camo)
    this.playerTank = createProceduralTank(false);
    this.playerTank.root.position.copy(this.playerTankState.pos);
    this.playerTank.root.rotation.y = this.playerTankState.hullRotY;
    this.scene.add(this.playerTank.root);

    // Opponent Tank (Urban Steel Gray Camo)
    this.opponentTank = createProceduralTank(true);
    this.opponentTank.root.position.copy(this.opponentRemoteState.pos);
    this.opponentTank.root.rotation.y = this.opponentRemoteState.hullRotY;
    this.scene.add(this.opponentTank.root);
  }

  requestLock() {
    if (this.renderer && this.renderer.domElement && !document.pointerLockElement) {
      try {
        this.renderer.domElement.requestPointerLock();
      } catch (err) {}
    }
  }

  exitLock() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  initListeners() {
    this.onCanvasClick = () => {
      sounds.init();
      if (this.isAlive && !document.pointerLockElement) {
        this.requestLock();
      }
    };

    this.onLockChange = () => {
      this.isLocked = document.pointerLockElement === this.renderer.domElement;
      this.onPointerLockChange(this.isLocked);
    };

    this.onKeyDown = (e) => {
      if ((e.ctrlKey && e.altKey) || e.key === 'Escape') {
        this.exitLock();
        return;
      }
      if (!this.isAlive) return;

      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.keys.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown') this.keys.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = true;
    };

    this.onKeyUp = (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.keys.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown') this.keys.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = false;
    };

    this.onMouseMove = (e) => {
      if (!this.isAlive || !document.pointerLockElement) return;

      const dx = e.movementX || 0;
      const dy = e.movementY || 0;

      const sens = this.isAiming ? this.mouseSensitivity * 0.35 : this.mouseSensitivity;
      this.camYaw -= dx * sens;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch - dy * sens, -0.15, 0.7);

      this.playerTankState.targetTurretYaw = this.camYaw;
      this.playerTankState.cannonPitch = THREE.MathUtils.clamp(-this.camPitch * 0.45, -0.12, 0.3);
    };

    this.onMouseDown = (e) => {
      sounds.init();
      if (!document.pointerLockElement) {
        this.requestLock();
        return;
      }

      if (e.button === 2) {
        this.setAiming(true);
      } else if (e.button === 0) {
        this.shootPlayerCannon();
      }
    };

    this.onMouseUp = (e) => {
      if (e.button === 2) {
        this.setAiming(false);
      }
    };

    this.onContextMenu = (e) => e.preventDefault();

    this.onResize = () => {
      if (!this.container || !this.renderer) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    this.container.addEventListener('click', this.onCanvasClick);
    document.addEventListener('pointerlockchange', this.onLockChange);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('resize', this.onResize);

    setTimeout(() => this.requestLock(), 250);
  }

  setAiming(aiming) {
    if (this.isAiming === aiming) return;
    this.isAiming = aiming;
    this.onAimState(this.isAiming);
  }

  shootPlayerCannon() {
    if (!this.isAlive || !this.canShoot || !this.opponentAlive) return;

    this.canShoot = false;
    this.reloadProgress = 0;
    this.onReloadState(false, 0);

    sounds.playTankCannon(false);
    this.addCameraTrauma(0.5);

    // Muzzle flash animation
    this.triggerMuzzleFlash(this.playerTank);

    // Hull recoil kick
    this.playerTankState.speed -= 2.2;
    this.playerTank.barrelGroup.position.z -= 0.35;

    // Shell spawn from barrel tip
    const spawnPos = new THREE.Vector3();
    this.playerTank.barrelGroup.getWorldPosition(spawnPos);
    const barrelDir = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), this.playerTankState.cannonPitch)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerTankState.turretYaw)
      .normalize();

    spawnPos.add(barrelDir.clone().multiplyScalar(4.5));

    this.spawnShell(spawnPos, barrelDir, 95, true);

    this.onShotFired({
      origin: spawnPos.toArray(),
      direction: barrelDir.toArray(),
    });

    // Start reload countdown
    const reloadStart = performance.now();
    const reloadTimer = setInterval(() => {
      const elapsed = (performance.now() - reloadStart) / 1000;
      this.reloadProgress = Math.min(1.0, elapsed / this.reloadTime);
      this.onReloadState(this.reloadProgress >= 1.0, this.reloadProgress);

      if (this.reloadProgress >= 1.0) {
        clearInterval(reloadTimer);
        this.canShoot = true;
        sounds.playTankReload();
      }
    }, 50);
  }

  triggerMuzzleFlash(tankModel) {
    if (!tankModel.muzzleLight || !tankModel.muzzleFlash) return;
    tankModel.muzzleLight.intensity = 18;
    tankModel.muzzleFlash.material.opacity = 0.95;
    tankModel.muzzleFlash.scale.set(1.6, 1.6, 2.8);

    setTimeout(() => {
      if (tankModel.muzzleLight) tankModel.muzzleLight.intensity = 0;
      if (tankModel.muzzleFlash) {
        tankModel.muzzleFlash.material.opacity = 0;
        tankModel.muzzleFlash.scale.set(1, 1, 1);
      }
    }, 70);
  }

  spawnShell(pos, dir, speed, isLocalPlayer) {
    const geo = new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff066 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.scene.add(mesh);

    this.shells.push({
      mesh,
      pos: pos.clone(),
      velocity: dir.clone().multiplyScalar(speed),
      gravity: -3.5,
      isLocalPlayer,
      life: 4.0,
    });
  }

  onRemoteShot(shotData) {
    sounds.playTankCannon(true);
    this.triggerMuzzleFlash(this.opponentTank);

    const origin = new THREE.Vector3(...shotData.origin);
    const dir = new THREE.Vector3(...shotData.direction);
    this.spawnShell(origin, dir, 95, false);
  }

  syncRemoteTank(remoteState) {
    if (!this.opponentTank || !this.opponentAlive) return;
    this.opponentRemoteState = {
      pos: new THREE.Vector3(remoteState.x, 0, remoteState.z),
      hullRotY: remoteState.hullRotY,
      speed: remoteState.speed || 0,
      turretYaw: remoteState.turretYaw,
      cannonPitch: remoteState.cannonPitch,
    };
  }

  addCameraTrauma(amount) {
    this.cameraTrauma = Math.min(1.0, this.cameraTrauma + amount);
  }

  applyDamageToOpponent(damage, partName, hitPoint) {
    if (!this.opponentAlive) return;

    this.opponentHp = Math.max(0, this.opponentHp - damage);
    this.onOpponentHpChange(this.opponentHp, this.maxHp);

    sounds.playTankHit(true);
    this.triggerExplosion(hitPoint, false);

    if (this.opponentHp <= 0) {
      this.opponentAlive = false;
      sounds.playTankExplosion();
      sounds.playVictory();
      this.triggerExplosion(this.opponentTank.root.position, true);
      this.animateTankDestruction(this.opponentTank);
      this.onKill({
        killer: 'Bạn',
        part: partName,
        distance: Math.round(this.playerTankState.pos.distanceTo(this.opponentTank.root.position)),
      });
    }
  }

  applyDamageToPlayer(damage, partName, hitPoint) {
    if (!this.isAlive) return;

    this.playerHp = Math.max(0, this.playerHp - damage);
    this.onPlayerHpChange(this.playerHp, this.maxHp);

    sounds.playTankHit(true);
    this.addCameraTrauma(0.85);
    this.triggerExplosion(hitPoint, false);

    if (this.playerHp <= 0) {
      this.isAlive = false;
      sounds.playTankExplosion();
      sounds.playDefeat();
      this.triggerExplosion(this.playerTank.root.position, true);
      this.animateTankDestruction(this.playerTank);
      this.onHit({
        killer: this.isBotMode ? 'Chiến Tăng Bot AI' : 'Đối Thủ',
        part: partName,
      });
    }
  }

  /**
   * MÃN NHÃN EXPLOSION EFFECT:
   * - Expanding bright fireball
   * - Expanding ground shockwave ring
   * - Billowing smoke clouds
   * - High-velocity fiery sparks
   * - Ground blast crater scorch mark
   * - Camera trauma shake
   */
  triggerExplosion(point, isDestruction = false) {
    const scaleMult = isDestruction ? 2.5 : 1.2;

    // 1. Screen Trauma based on distance
    const distToPlayer = point.distanceTo(this.playerTankState.pos);
    if (distToPlayer < 50) {
      const shakeFactor = Math.max(0.2, (1 - distToPlayer / 50)) * (isDestruction ? 1.0 : 0.6);
      this.addCameraTrauma(shakeFactor);
    }

    // 2. Expanding Core Fireball
    const fireGeo = new THREE.SphereGeometry(isDestruction ? 2.2 : 1.2, 16, 16);
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xffea44,
      transparent: true,
      opacity: 0.95,
    });
    const fireMesh = new THREE.Mesh(fireGeo, fireMat);
    fireMesh.position.copy(point).add(new THREE.Vector3(0, 0.8, 0));
    this.scene.add(fireMesh);

    // 3. Shockwave Ring (flat on ground)
    const ringGeo = new THREE.RingGeometry(0.5, 1.2, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff9922,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(point.x, 0.08, point.z);
    this.scene.add(ringMesh);

    // 4. Ground Scorch Crater Decal (Persistent charred blast mark)
    const craterGeo = new THREE.CircleGeometry(isDestruction ? 3.6 : 1.8, 16);
    const craterMat = new THREE.MeshBasicMaterial({
      color: 0x181410,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const craterMesh = new THREE.Mesh(craterGeo, craterMat);
    craterMesh.rotation.x = -Math.PI / 2;
    craterMesh.position.set(point.x, 0.02, point.z);
    this.scene.add(craterMesh);
    this.scorchMarks.push(craterMesh);
    if (this.scorchMarks.length > 30) {
      const old = this.scorchMarks.shift();
      this.scene.remove(old);
      old.geometry.dispose();
    }

    // 5. Dynamic Flash Light
    const flashLight = new THREE.PointLight(0xff7722, isDestruction ? 35 : 18, isDestruction ? 40 : 25);
    flashLight.position.copy(point).add(new THREE.Vector3(0, 2, 0));
    this.scene.add(flashLight);

    // 6. Flying Fiery Sparks
    const sparkCount = isDestruction ? 45 : 25;
    const sparkGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(sparkCount * 3);
    const velocities = [];

    for (let i = 0; i < sparkCount; i++) {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y + 0.5;
      positions[i * 3 + 2] = point.z;

      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 16 * scaleMult,
          Math.random() * 14 * scaleMult + 4,
          (Math.random() - 0.5) * 16 * scaleMult
        )
      );
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 0.35,
      transparent: true,
      opacity: 1,
    });
    const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    this.scene.add(sparkPoints);

    // 7. Billowing Smoke Plumes
    const smokePuffs = [];
    for (let i = 0; i < (isDestruction ? 6 : 3); i++) {
      const sGeo = new THREE.DodecahedronGeometry(0.8 * scaleMult);
      const sMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.95,
        transparent: true,
        opacity: 0.7,
        flatShading: true,
      });
      const sMesh = new THREE.Mesh(sGeo, sMat);
      sMesh.position.copy(point).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          0.8 + i * 0.4,
          (Math.random() - 0.5) * 1.5
        )
      );
      this.scene.add(sMesh);
      smokePuffs.push({
        mesh: sMesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          Math.random() * 2.5 + 1.5,
          (Math.random() - 0.5) * 1.5
        ),
      });
    }

    this.effects.push({
      fireMesh,
      ringMesh,
      flashLight,
      sparkPoints,
      sparkVelocities: velocities,
      smokePuffs,
      maxLife: isDestruction ? 1.6 : 0.9,
      life: isDestruction ? 1.6 : 0.9,
      isDestruction,
    });
  }

  animateTankDestruction(tankModel) {
    let elapsed = 0;
    const turret = tankModel.turretGroup;
    const anim = () => {
      elapsed += 0.016;
      if (elapsed < 1.4 && turret) {
        turret.position.y += 0.16 - elapsed * 0.14;
        turret.rotation.x += 0.06;
        turret.rotation.z += 0.04;
        requestAnimationFrame(anim);
      }
    };
    anim();
  }

  /**
   * Precise Collision Detection:
   * - Arena Boundary: circular boundary
   * - Rocks / Dragon's Teeth: circle-circle distance
   * - Walls: distance from point to line-segment (no oversized invisible bubbles!)
   */
  checkCollision(pos) {
    const tankRadius = 1.9;

    // 1. Arena Perimeter
    if (pos.length() > this.battlefield.arenaRadius - tankRadius) {
      return true;
    }

    // 2. Obstacles
    for (const obs of this.battlefield.obstacles) {
      if (obs.type === 'WALL') {
        const d = this.distToSegment(new THREE.Vector2(pos.x, pos.z), obs.p1, obs.p2);
        if (d < obs.thickness * 0.5 + tankRadius) {
          return true;
        }
      } else if (obs.type === 'CYLINDER') {
        const d = new THREE.Vector2(pos.x, pos.z).distanceTo(obs.pos);
        if (d < obs.radius + tankRadius) {
          return true;
        }
      }
    }

    return false;
  }

  distToSegment(p, v, w) {
    const l2 = v.distanceToSquared(w);
    if (l2 === 0) return p.distanceTo(v);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = new THREE.Vector2(v.x + t * (w.x - v.x), v.y + t * (w.y - v.y));
    return p.distanceTo(proj);
  }

  updatePlayerTank(delta) {
    if (!this.isAlive) return;

    const s = this.playerTankState;

    // 1. Steering & Pivot Turns
    if (this.keys.left) {
      s.hullRotY += s.turnSpeed * delta;
    }
    if (this.keys.right) {
      s.hullRotY -= s.turnSpeed * delta;
    }

    // 2. Acceleration & Braking
    if (this.keys.forward) {
      s.speed = Math.min(s.maxForwardSpeed, s.speed + s.accel * delta);
    } else if (this.keys.backward) {
      s.speed = Math.max(-s.maxReverseSpeed, s.speed - s.brake * delta);
    } else {
      if (s.speed > 0) {
        s.speed = Math.max(0, s.speed - 9.0 * delta);
      } else if (s.speed < 0) {
        s.speed = Math.min(0, s.speed + 9.0 * delta);
      }
    }

    // 3. Move along hull facing vector
    // Facing direction: (0, 0, -1) rotated by hullRotY
    const moveDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.hullRotY);
    const nextPos = s.pos.clone().add(moveDir.multiplyScalar(s.speed * delta));

    // 4. Test collision
    if (this.checkCollision(nextPos)) {
      s.speed *= -0.2; // Bounce back gently
    } else {
      s.pos.copy(nextPos);
    }

    // Apply to 3D Tank Root
    this.playerTank.root.position.copy(s.pos);
    this.playerTank.root.rotation.y = s.hullRotY;

    // Animate road wheels rotating based on speed
    for (const w of this.playerTank.wheels) {
      w.rotation.x += s.speed * delta * 2.5;
    }

    // Barrel recoil restoration
    this.playerTank.barrelGroup.position.z = THREE.MathUtils.lerp(
      this.playerTank.barrelGroup.position.z,
      1.15,
      delta * 12
    );

    // 5. Smooth Turret Traversal towards mouse target
    let diff = s.targetTurretYaw - s.turretYaw;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    s.turretYaw += diff * Math.min(delta * 10, 1);

    const localTurretAngle = s.turretYaw - s.hullRotY;
    this.playerTank.turretGroup.rotation.y = localTurretAngle;
    this.playerTank.barrelGroup.rotation.x = s.cannonPitch;

    // Update Speedometer UI
    const kmh = Math.round(Math.abs(s.speed) * 3.6);
    const gear = s.speed > 0.5 ? 'D' : s.speed < -0.5 ? 'R' : 'N';
    this.onSpeedChange(kmh, gear);
  }

  updateBot(delta) {
    if (!this.isBotMode || !this.opponentAlive || !this.isAlive) return;

    const b = this.botState;
    const oppRoot = this.opponentTank.root;

    b.moveTimer -= delta;
    b.shootTimer -= delta;

    const toPlayer = this.playerTankState.pos.clone().sub(oppRoot.position);
    const distToPlayer = toPlayer.length();

    // Desired angle towards player
    const angleToPlayer = Math.atan2(toPlayer.x, -toPlayer.z);

    let hullDiff = angleToPlayer - oppRoot.rotation.y;
    while (hullDiff < -Math.PI) hullDiff += Math.PI * 2;
    while (hullDiff > Math.PI) hullDiff -= Math.PI * 2;
    oppRoot.rotation.y += Math.sign(hullDiff) * Math.min(Math.abs(hullDiff), 1.5 * delta);

    let botSpeed = 0;
    if (distToPlayer > 26) {
      botSpeed = 8.0;
    } else if (distToPlayer < 14) {
      botSpeed = -4.0;
    } else {
      botSpeed = 3.0 * b.strafeDir;
    }

    if (b.moveTimer <= 0) {
      b.strafeDir *= -1;
      b.moveTimer = 2.5 + Math.random() * 2.0;
    }

    const forwardVec = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), oppRoot.rotation.y);
    const nextOppPos = oppRoot.position.clone().add(forwardVec.multiplyScalar(botSpeed * delta));

    if (!this.checkCollision(nextOppPos)) {
      oppRoot.position.copy(nextOppPos);
    }

    // AI Turret aiming at player
    const localAngle = angleToPlayer - oppRoot.rotation.y;
    this.opponentTank.turretGroup.rotation.y = THREE.MathUtils.lerp(
      this.opponentTank.turretGroup.rotation.y,
      localAngle,
      delta * 6
    );

    // AI Shooting
    if (b.shootTimer <= 0 && distToPlayer < 65) {
      b.shootTimer = 3.6 + Math.random() * 1.5;

      sounds.playTankCannon(true);
      this.triggerMuzzleFlash(this.opponentTank);

      const barrelWorldPos = new THREE.Vector3();
      this.opponentTank.barrelGroup.getWorldPosition(barrelWorldPos);

      const aimTarget = this.playerTankState.pos.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 2.0, 0.8, (Math.random() - 0.5) * 2.0)
      );
      const fireDir = aimTarget.sub(barrelWorldPos).normalize();

      this.spawnShell(barrelWorldPos, fireDir, 90, false);
    }
  }

  updateCamera(delta) {
    if (!this.playerTank) return;

    const s = this.playerTankState;

    // Decay trauma
    this.cameraTrauma = Math.max(0, this.cameraTrauma - delta * 2.2);
    const shakeYaw = (Math.random() - 0.5) * this.cameraTrauma * 0.04;
    const shakePitch = (Math.random() - 0.5) * this.cameraTrauma * 0.04;

    if (this.isAiming) {
      // 1. FIRST PERSON GUNNER OPTIC (ADS 6x Sniper Sight)
      const gunPos = new THREE.Vector3();
      this.playerTank.barrelGroup.getWorldPosition(gunPos);

      const forward = new THREE.Vector3(0, 0, -1)
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), s.cannonPitch)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), s.turretYaw);

      this.camera.position.copy(gunPos).add(new THREE.Vector3(0, 0.45, 0)).add(forward.clone().multiplyScalar(0.8));
      this.camera.lookAt(this.camera.position.clone().add(forward));

      this.camera.rotation.y += shakeYaw;
      this.camera.rotation.x += shakePitch;

      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 18, delta * 15);
      this.camera.updateProjectionMatrix();
    } else {
      // 2. THIRD PERSON CHASE CAM (Over the shoulder)
      const camDist = 9.5;
      const camHeight = 3.6;

      const offset = new THREE.Vector3(0, camHeight, camDist);
      offset.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.camPitch * 0.45);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camYaw);

      const targetCamPos = s.pos.clone().add(new THREE.Vector3(0, 1.2, 0)).add(offset);
      this.camera.position.lerp(targetCamPos, delta * 18);

      const lookTarget = s.pos.clone().add(new THREE.Vector3(0, 2.0, 0)).add(
        new THREE.Vector3(0, 0, -8.0).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.turretYaw)
      );
      this.camera.lookAt(lookTarget);

      this.camera.rotation.y += shakeYaw;
      this.camera.rotation.x += shakePitch;

      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 65, delta * 15);
      this.camera.updateProjectionMatrix();
    }
  }

  updateShells(delta) {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.life -= delta;

      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        this.shells.splice(i, 1);
        continue;
      }

      s.velocity.y += s.gravity * delta;
      const nextPos = s.pos.clone().add(s.velocity.clone().multiplyScalar(delta));

      const rayDir = nextPos.clone().sub(s.pos);
      const dist = rayDir.length();
      rayDir.normalize();

      this.raycaster.set(s.pos, rayDir);
      this.raycaster.far = dist;

      const targets = [this.battlefield.ground];
      for (const obs of this.battlefield.obstacles) {
        targets.push(obs.mesh);
      }

      if (s.isLocalPlayer) {
        targets.push(
          this.opponentTank.glacis,
          this.opponentTank.mainHull,
          this.opponentTank.engineDeck,
          this.opponentTank.turretBody,
          this.opponentTank.mantlet
        );
      } else {
        targets.push(
          this.playerTank.glacis,
          this.playerTank.mainHull,
          this.playerTank.engineDeck,
          this.playerTank.turretBody,
          this.playerTank.mantlet
        );
      }

      const hits = this.raycaster.intersectObjects(targets, false);

      if (hits.length > 0) {
        const hit = hits[0];
        const obj = hit.object;

        if (obj === this.battlefield.ground || this.battlefield.obstacles.some((o) => o.mesh === obj)) {
          sounds.playRicochet();
          this.triggerExplosion(hit.point, false);
        } else if (obj.userData?.part) {
          const part = obj.userData.part;
          let damage = 280;

          if (part === 'REAR_WEAKSPOT') {
            damage = 480;
          } else if (part === 'FRONT_ARMOR' || part === 'MANTLET') {
            damage = 220;
          } else if (part === 'TURRET') {
            damage = 340;
          }

          if (s.isLocalPlayer) {
            this.applyDamageToOpponent(damage, part, hit.point);
          } else {
            this.applyDamageToPlayer(damage, part, hit.point);
          }
        }

        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        this.shells.splice(i, 1);
        continue;
      }

      s.pos.copy(nextPos);
      s.mesh.position.copy(s.pos);
      s.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.velocity.clone().normalize());
    }
  }

  updateVisualEffects(delta) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.life -= delta;
      const progress = 1.0 - fx.life / fx.maxLife;

      if (fx.life <= 0) {
        // Dispose
        this.scene.remove(fx.fireMesh);
        fx.fireMesh.geometry.dispose();
        fx.fireMesh.material.dispose();

        this.scene.remove(fx.ringMesh);
        fx.ringMesh.geometry.dispose();
        fx.ringMesh.material.dispose();

        this.scene.remove(fx.flashLight);

        this.scene.remove(fx.sparkPoints);
        fx.sparkPoints.geometry.dispose();
        fx.sparkPoints.material.dispose();

        for (const sm of fx.smokePuffs) {
          this.scene.remove(sm.mesh);
          sm.mesh.geometry.dispose();
          sm.mesh.material.dispose();
        }

        this.effects.splice(i, 1);
        continue;
      }

      // Animate Fireball
      const fireScale = 1.0 + progress * 3.2;
      fx.fireMesh.scale.set(fireScale, fireScale, fireScale);
      fx.fireMesh.material.opacity = Math.max(0, 1.0 - progress * 1.5);
      if (progress > 0.3) {
        fx.fireMesh.material.color.setHex(0xff3300);
      }

      // Animate Shockwave Ring
      const ringScale = 1.0 + progress * (fx.isDestruction ? 9.0 : 5.5);
      fx.ringMesh.scale.set(ringScale, ringScale, 1.0);
      fx.ringMesh.material.opacity = Math.max(0, 1.0 - progress * 1.3);

      // Animate Light Flash
      fx.flashLight.intensity = Math.max(0, (1.0 - progress * 3.0) * (fx.isDestruction ? 35 : 18));

      // Animate Sparks
      const pos = fx.sparkPoints.geometry.attributes.position;
      for (let j = 0; j < fx.sparkVelocities.length; j++) {
        pos.setXYZ(
          j,
          pos.getX(j) + fx.sparkVelocities[j].x * delta,
          pos.getY(j) + fx.sparkVelocities[j].y * delta,
          pos.getZ(j) + fx.sparkVelocities[j].z * delta
        );
        fx.sparkVelocities[j].y -= 14.0 * delta;
      }
      pos.needsUpdate = true;
      fx.sparkPoints.material.opacity = Math.max(0, 1.0 - progress);

      // Animate Billowing Smoke
      for (const sm of fx.smokePuffs) {
        sm.mesh.position.add(sm.vel.clone().multiplyScalar(delta));
        sm.vel.multiplyScalar(0.96);
        sm.mesh.scale.multiplyScalar(1.0 + delta * 0.8);
        sm.mesh.material.opacity = Math.max(0, (1.0 - progress) * 0.65);
      }
    }
  }

  startLoop() {
    const tick = () => {
      this.animationFrameId = requestAnimationFrame(tick);
      const delta = Math.min(this.clock.getDelta(), 0.1);

      this.updatePlayerTank(delta);

      if (this.isBotMode) {
        this.updateBot(delta);
      } else if (this.opponentTank && this.opponentAlive) {
        // Smooth remote opponent interpolation
        const lerpSpeed = Math.min(delta * 14, 1);
        this.opponentTank.root.position.lerp(this.opponentRemoteState.pos, lerpSpeed);
        this.opponentTank.root.rotation.y = THREE.MathUtils.lerp(
          this.opponentTank.root.rotation.y,
          this.opponentRemoteState.hullRotY,
          lerpSpeed
        );

        const localTurret = this.opponentRemoteState.turretYaw - this.opponentRemoteState.hullRotY;
        this.opponentTank.turretGroup.rotation.y = THREE.MathUtils.lerp(
          this.opponentTank.turretGroup.rotation.y,
          localTurret,
          lerpSpeed
        );
        this.opponentTank.barrelGroup.rotation.x = THREE.MathUtils.lerp(
          this.opponentTank.barrelGroup.rotation.x,
          this.opponentRemoteState.cannonPitch,
          lerpSpeed
        );
      }

      this.updateCamera(delta);
      this.updateShells(delta);
      this.updateVisualEffects(delta);

      this.renderer.render(this.scene, this.camera);
    };

    tick();
  }

  resetRound() {
    this.playerHp = this.maxHp;
    this.opponentHp = this.maxHp;
    this.isAlive = true;
    this.opponentAlive = true;
    this.canShoot = true;
    this.reloadProgress = 1.0;
    this.isAiming = false;
    this.cameraTrauma = 0;

    this.onPlayerHpChange(this.playerHp, this.maxHp);
    this.onOpponentHpChange(this.opponentHp, this.maxHp);
    this.onReloadState(true, 1.0);

    // Reset Player Tank to base
    const isSouthSpawn = this.isHost;
    const startZ = isSouthSpawn ? 36 : -36;
    const oppStartZ = isSouthSpawn ? -36 : 36;
    const startFacing = isSouthSpawn ? 0 : Math.PI;

    this.playerTankState.pos.set(0, 0, startZ);
    this.playerTankState.hullRotY = startFacing;
    this.playerTankState.speed = 0;
    this.playerTankState.turretYaw = startFacing;
    this.playerTankState.targetTurretYaw = startFacing;
    this.camYaw = startFacing;
    this.camPitch = 0.20;

    this.playerTank.root.position.copy(this.playerTankState.pos);
    this.playerTank.root.rotation.y = this.playerTankState.hullRotY;
    this.playerTank.turretGroup.position.set(0, 1.25, 0.1);
    this.playerTank.turretGroup.rotation.set(0, 0, 0);

    // Reset Opponent Tank to opposite base
    this.opponentRemoteState.pos.set(0, 0, oppStartZ);
    this.opponentRemoteState.hullRotY = isSouthSpawn ? Math.PI : 0;
    this.opponentRemoteState.turretYaw = isSouthSpawn ? Math.PI : 0;

    this.opponentTank.root.position.copy(this.opponentRemoteState.pos);
    this.opponentTank.root.rotation.y = this.opponentRemoteState.hullRotY;
    this.opponentTank.turretGroup.position.set(0, 1.25, 0.1);
    this.opponentTank.turretGroup.rotation.set(0, 0, 0);

    for (const s of this.shells) {
      this.scene.remove(s.mesh);
    }
    this.shells = [];
  }

  destroy() {
    cancelAnimationFrame(this.animationFrameId);
    this.container.removeEventListener('click', this.onCanvasClick);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('resize', this.onResize);

    this.exitLock();

    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
    }
  }
}
