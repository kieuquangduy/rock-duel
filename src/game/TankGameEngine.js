import * as THREE from 'three';
import { createProceduralTank, createTankBattlefield } from './TankProceduralModels';
import { sounds } from '../audio/SoundEffects';

export class TankGameEngine {
  constructor(canvasContainer, options = {}) {
    this.container = canvasContainer;
    this.isBotMode = options.isBotMode ?? true;
    this.mapDistance = options.mapDistance || 50; // Arena scaling

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

    // Movement & Driving Physics
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
    };

    this.playerTankState = {
      pos: new THREE.Vector3(0, 0, 32),
      hullRotY: Math.PI, // Facing north towards opponent
      speed: 0,
      maxForwardSpeed: 13.5, // m/s (~48 km/h)
      maxReverseSpeed: 6.5,  // m/s (~23 km/h)
      accel: 14.0,
      brake: 22.0,
      turnSpeed: 1.85,       // rad/s
      turretYaw: Math.PI,    // Relative to world
      targetTurretYaw: Math.PI,
      cannonPitch: 0,
    };

    // Camera
    this.camYaw = Math.PI;
    this.camPitch = 0.22;
    this.mouseSensitivity = 0.0024;

    // Opponent Remote State for Interpolation
    this.opponentRemoteState = {
      pos: new THREE.Vector3(0, 0, -32),
      hullRotY: 0,
      speed: 0,
      turretYaw: 0,
      cannonPitch: 0,
    };

    // Active Projectiles & Particles
    this.shells = [];
    this.particles = [];
    this.explosions = [];

    // Bot AI state
    this.botState = {
      targetPos: new THREE.Vector3(0, 0, -32),
      moveTimer: 2.0,
      shootTimer: 2.5,
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
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.style.cursor = 'none';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc9a882); // Desert sky
    this.scene.fog = new THREE.FogExp2(0xc9a882, 0.007);

    this.camera = new THREE.PerspectiveCamera(
      65,
      this.container.clientWidth / this.container.clientHeight,
      0.2,
      450
    );

    // Lighting
    const ambient = new THREE.AmbientLight(0xfff5ea, 0.7);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfffaee, 1.85);
    sun.position.set(40, 60, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 180;
    const shadowSize = 65;
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
    const startOppZ = this.isBotMode ? -35 : -this.mapDistance;
    this.opponentRemoteState.pos.set(0, 0, startOppZ);
    this.opponentTank.root.position.copy(this.opponentRemoteState.pos);
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

    // Muzzle flash animation
    this.triggerMuzzleFlash(this.playerTank);

    // Hull recoil kick
    const recoilDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerTankState.turretYaw);
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

    this.spawnShell(spawnPos, barrelDir, 90, true);

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
    tankModel.muzzleLight.intensity = 15;
    tankModel.muzzleFlash.material.opacity = 0.95;
    tankModel.muzzleFlash.scale.set(1.5, 1.5, 2.5);

    setTimeout(() => {
      if (tankModel.muzzleLight) tankModel.muzzleLight.intensity = 0;
      if (tankModel.muzzleFlash) {
        tankModel.muzzleFlash.material.opacity = 0;
        tankModel.muzzleFlash.scale.set(1, 1, 1);
      }
    }, 65);
  }

  spawnShell(pos, dir, speed, isLocalPlayer) {
    const geo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.scene.add(mesh);

    this.shells.push({
      mesh,
      pos: pos.clone(),
      velocity: dir.clone().multiplyScalar(speed),
      gravity: -3.5, // slight trajectory drop
      isLocalPlayer,
      life: 4.0,
    });
  }

  onRemoteShot(shotData) {
    sounds.playTankCannon(true);
    this.triggerMuzzleFlash(this.opponentTank);

    const origin = new THREE.Vector3(...shotData.origin);
    const dir = new THREE.Vector3(...shotData.direction);
    this.spawnShell(origin, dir, 90, false);
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

  applyDamageToOpponent(damage, partName, hitPoint) {
    if (!this.opponentAlive) return;

    this.opponentHp = Math.max(0, this.opponentHp - damage);
    this.onOpponentHpChange(this.opponentHp, this.maxHp);

    sounds.playTankHit(true);
    this.spawnImpactSparks(hitPoint, damage >= 400 ? 0xff2200 : 0xff9900);

    if (this.opponentHp <= 0) {
      this.opponentAlive = false;
      sounds.playTankExplosion();
      sounds.playVictory();
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
    this.spawnImpactSparks(hitPoint, damage >= 400 ? 0xff2200 : 0xff9900);

    if (this.playerHp <= 0) {
      this.isAlive = false;
      sounds.playTankExplosion();
      sounds.playDefeat();
      this.animateTankDestruction(this.playerTank);
      this.onHit({
        killer: this.isBotMode ? 'Chiến Tăng Bot AI' : 'Đối Thủ',
        part: partName,
      });
    }
  }

  animateTankDestruction(tankModel) {
    // Pop turret off with smoke & flip
    let elapsed = 0;
    const turret = tankModel.turretGroup;
    const anim = () => {
      elapsed += 0.016;
      if (elapsed < 1.4 && turret) {
        turret.position.y += 0.12 - elapsed * 0.12;
        turret.rotation.x += 0.05;
        turret.rotation.z += 0.03;
        requestAnimationFrame(anim);
      }
    };
    anim();

    // Spawn massive fiery debris
    const pos = tankModel.root.position;
    for (let i = 0; i < 40; i++) {
      this.spawnDebris(pos);
    }
  }

  spawnImpactSparks(point, color = 0xffa500) {
    const count = 18;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;

      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          Math.random() * 8 + 2,
          (Math.random() - 0.5) * 8
        )
      );
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.25, transparent: true, opacity: 1 });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    this.particles.push({ points, velocities, life: 0.45 });
  }

  spawnDebris(origin) {
    const geo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2));
    this.scene.add(mesh);

    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 12,
      Math.random() * 12 + 4,
      (Math.random() - 0.5) * 12
    );

    this.explosions.push({ mesh, vel, life: 2.0 });
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
      // Natural rolling friction resistance
      if (s.speed > 0) {
        s.speed = Math.max(0, s.speed - 9.0 * delta);
      } else if (s.speed < 0) {
        s.speed = Math.min(0, s.speed + 9.0 * delta);
      }
    }

    // 3. Move along hull facing vector
    const moveDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.hullRotY);
    const nextPos = s.pos.clone().add(moveDir.multiplyScalar(s.speed * delta));

    // 4. Collision check with obstacles & boundary
    const tankRadius = 2.4;
    let collision = false;

    // Arena boundary clamp
    if (nextPos.length() > this.battlefield.arenaRadius - tankRadius) {
      nextPos.setLength(this.battlefield.arenaRadius - tankRadius);
      s.speed *= -0.2; // Bounce slightly
      collision = true;
    }

    // Obstacle collision
    for (const obs of this.battlefield.obstacles) {
      const dist = new THREE.Vector2(nextPos.x, nextPos.z).distanceTo(obs.pos);
      if (dist < obs.radius + tankRadius) {
        s.speed *= -0.25;
        collision = true;
        break;
      }
    }

    if (!collision) {
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
    // Calculate shortest angular distance
    let diff = s.targetTurretYaw - s.turretYaw;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    s.turretYaw += diff * Math.min(delta * 10, 1);

    // Relative turret rotation inside the hull group
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

    // AI Driving: Move towards player while strafing
    const toPlayer = this.playerTankState.pos.clone().sub(oppRoot.position);
    const distToPlayer = toPlayer.length();

    // Desired angle towards player
    const angleToPlayer = Math.atan2(toPlayer.x, toPlayer.z);

    // AI Hull steering
    let hullDiff = angleToPlayer - oppRoot.rotation.y;
    while (hullDiff < -Math.PI) hullDiff += Math.PI * 2;
    while (hullDiff > Math.PI) hullDiff -= Math.PI * 2;
    oppRoot.rotation.y += Math.sign(hullDiff) * Math.min(Math.abs(hullDiff), 1.4 * delta);

    // Drive forward if far, reverse if too close
    let botSpeed = 0;
    if (distToPlayer > 26) {
      botSpeed = 8.5;
    } else if (distToPlayer < 14) {
      botSpeed = -4.5;
    } else {
      botSpeed = 3.0 * b.strafeDir;
    }

    if (b.moveTimer <= 0) {
      b.strafeDir *= -1;
      b.moveTimer = 2.5 + Math.random() * 2.0;
    }

    const forwardVec = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), oppRoot.rotation.y);
    oppRoot.position.add(forwardVec.multiplyScalar(botSpeed * delta));

    // Clamp inside arena
    if (oppRoot.position.length() > this.battlefield.arenaRadius - 4) {
      oppRoot.position.setLength(this.battlefield.arenaRadius - 4);
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
      b.shootTimer = 3.8 + Math.random() * 1.5;

      sounds.playTankCannon(true);
      this.triggerMuzzleFlash(this.opponentTank);

      const barrelWorldPos = new THREE.Vector3();
      this.opponentTank.barrelGroup.getWorldPosition(barrelWorldPos);

      // Lead aim towards player with a slight random inaccuracy
      const aimTarget = this.playerTankState.pos.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 2.2,
        0.8,
        (Math.random() - 0.5) * 2.2
      ));
      const fireDir = aimTarget.sub(barrelWorldPos).normalize();

      this.spawnShell(barrelWorldPos, fireDir, 85, false);
    }
  }

  updateCamera(delta) {
    if (!this.playerTank) return;

    const s = this.playerTankState;

    if (this.isAiming) {
      // 1. FIRST PERSON GUNNER OPTIC (ADS 6x Sniper Sight)
      const gunPos = new THREE.Vector3();
      this.playerTank.barrelGroup.getWorldPosition(gunPos);

      const forward = new THREE.Vector3(0, 0, 1)
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), s.cannonPitch)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), s.turretYaw);

      this.camera.position.copy(gunPos).add(new THREE.Vector3(0, 0.45, 0)).add(forward.clone().multiplyScalar(0.8));
      this.camera.lookAt(this.camera.position.clone().add(forward));

      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 18, delta * 15);
      this.camera.updateProjectionMatrix();
    } else {
      // 2. THIRD PERSON CHASE CAM (Over the shoulder)
      const camDist = 9.5;
      const camHeight = 3.6;

      const offset = new THREE.Vector3(0, camHeight, -camDist);
      offset.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.camPitch * 0.45);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camYaw);

      const targetCamPos = s.pos.clone().add(new THREE.Vector3(0, 1.2, 0)).add(offset);
      this.camera.position.lerp(targetCamPos, delta * 18);

      const lookTarget = s.pos.clone().add(new THREE.Vector3(0, 2.0, 0)).add(
        new THREE.Vector3(0, 0, 8.0).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.turretYaw)
      );
      this.camera.lookAt(lookTarget);

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

      // Ballistic trajectory
      s.velocity.y += s.gravity * delta;
      const nextPos = s.pos.clone().add(s.velocity.clone().multiplyScalar(delta));

      // Raycast collision segment from pos to nextPos
      const rayDir = nextPos.clone().sub(s.pos);
      const dist = rayDir.length();
      rayDir.normalize();

      this.raycaster.set(s.pos, rayDir);
      this.raycaster.far = dist;

      // Targets to hit
      const targets = [this.battlefield.ground];
      for (const obs of this.battlefield.obstacles) {
        targets.push(obs.mesh);
      }

      if (s.isLocalPlayer) {
        // Player's shell targets opponent tank hitboxes
        targets.push(
          this.opponentTank.glacis,
          this.opponentTank.mainHull,
          this.opponentTank.engineDeck,
          this.opponentTank.turretBody,
          this.opponentTank.mantlet
        );
      } else {
        // Opponent's shell targets player tank hitboxes
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
          // Hit dirt or obstacle
          sounds.playRicochet();
          this.spawnImpactSparks(hit.point, 0xffbb44);
        } else if (obj.userData?.part) {
          // Hit Tank Armor!
          const part = obj.userData.part;
          let damage = 280;

          if (part === 'REAR_WEAKSPOT') {
            damage = 480; // Heavy engine detonation
          } else if (part === 'FRONT_ARMOR' || part === 'MANTLET') {
            damage = 220; // Glancing frontal deflection
          } else if (part === 'TURRET') {
            damage = 340;
          }

          if (s.isLocalPlayer) {
            this.applyDamageToOpponent(damage, part, hit.point);
          } else {
            this.applyDamageToPlayer(damage, part, hit.point);
          }
        }

        // Remove shell
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

  updateParticles(delta) {
    // Impact sparks
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.scene.remove(p.points);
        p.points.geometry.dispose();
        this.particles.splice(i, 1);
      } else {
        const pos = p.points.geometry.attributes.position;
        for (let j = 0; j < p.velocities.length; j++) {
          pos.setXYZ(
            j,
            pos.getX(j) + p.velocities[j].x * delta,
            pos.getY(j) + p.velocities[j].y * delta,
            pos.getZ(j) + p.velocities[j].z * delta
          );
          p.velocities[j].y -= 9.8 * delta;
        }
        pos.needsUpdate = true;
        p.points.material.opacity = p.life / 0.45;
      }
    }

    // Explosion debris
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= delta;
      if (ex.life <= 0) {
        this.scene.remove(ex.mesh);
        ex.mesh.geometry.dispose();
        this.explosions.splice(i, 1);
      } else {
        ex.mesh.position.add(ex.vel.clone().multiplyScalar(delta));
        ex.vel.y -= 14.0 * delta;
        ex.mesh.rotation.x += 2 * delta;
        ex.mesh.rotation.y += 2 * delta;
        if (ex.mesh.position.y < 0.2) {
          ex.mesh.position.y = 0.2;
          ex.vel.multiplyScalar(0.4);
        }
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
      this.updateParticles(delta);

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

    this.onPlayerHpChange(this.playerHp, this.maxHp);
    this.onOpponentHpChange(this.opponentHp, this.maxHp);
    this.onReloadState(true, 1.0);

    // Reset Player Tank
    this.playerTankState.pos.set(0, 0, 32);
    this.playerTankState.hullRotY = Math.PI;
    this.playerTankState.speed = 0;
    this.playerTankState.turretYaw = Math.PI;
    this.playerTankState.targetTurretYaw = Math.PI;
    this.camYaw = Math.PI;
    this.camPitch = 0.22;

    this.playerTank.root.position.copy(this.playerTankState.pos);
    this.playerTank.root.rotation.y = this.playerTankState.hullRotY;
    this.playerTank.turretGroup.position.set(0, 1.25, 0.1);
    this.playerTank.turretGroup.rotation.set(0, 0, 0);

    // Reset Opponent Tank
    const startOppZ = this.isBotMode ? -35 : -this.mapDistance;
    this.opponentRemoteState.pos.set(0, 0, startOppZ);
    this.opponentRemoteState.hullRotY = 0;
    this.opponentRemoteState.turretYaw = 0;

    this.opponentTank.root.position.copy(this.opponentRemoteState.pos);
    this.opponentTank.root.rotation.set(0, 0, 0);
    this.opponentTank.turretGroup.position.set(0, 1.25, 0.1);
    this.opponentTank.turretGroup.rotation.set(0, 0, 0);

    // Clean up active shells
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
