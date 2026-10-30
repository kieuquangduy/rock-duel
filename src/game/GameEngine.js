import * as THREE from 'three';
import { createProceduralRock, createOpponentAvatar, createFirstPersonRifle, createDesertEnvironment } from './ProceduralModels';
import { sounds } from '../audio/SoundEffects';

export class GameEngine {
  constructor(canvasContainer, options = {}) {
    this.container = canvasContainer;
    this.onHit = options.onHit || (() => {});
    this.onKill = options.onKill || (() => {});
    this.onShotFired = options.onShotFired || (() => {});
    this.onCoverChange = options.onCoverChange || (() => {});
    this.onBoltState = options.onBoltState || (() => {});

    this.mapDistance = options.mapDistance || 35; // 18, 35, 60
    this.isBotMode = options.isBotMode ?? true;

    // Game state
    this.isAlive = true;
    this.opponentAlive = true;
    this.isAiming = false;
    this.canShoot = true;
    this.isCovered = true;

    // Aim angles (Pitch & Yaw)
    this.aimYaw = 0;   // Radians (left/right)
    this.aimPitch = 0; // Radians (up/down)

    // Dynamic Peek Offset (Lean) calculated from aim & mouse
    this.peekOffset = { x: 0, y: 0 };
    this.targetLean = { x: 0, y: 0 };

    this.mouseSensitivity = 0.0022;

    // View recoil & sway
    this.recoil = { pitch: 0, yaw: 0 };
    this.swayTime = 0;

    // Raycaster for hit detection
    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();

    // Active visual effects
    this.tracers = [];
    this.sparks = [];

    // Bot AI state
    this.botState = {
      action: 'HIDE', // HIDE, PEEK
      timer: 1.2,
      targetPos: { x: 0, y: 0 },
      aimDuration: 0,
      reactionTime: 0.9,
    };

    this.initScene();
    this.initListeners();
    this.startLoop();
  }

  initScene() {
    // 1. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 2. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd9b38c);
    this.scene.fog = new THREE.FogExp2(0xd9b38c, 0.008);

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(
      70,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      400
    );
    this.baseCamPos = new THREE.Vector3(0, 1.25, 0);
    this.camera.position.copy(this.baseCamPos);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xfff0dd, 0.75);
    this.scene.add(ambientLight);

    const sun = new THREE.DirectionalLight(0xfffaed, 1.9);
    sun.position.set(25, 45, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    this.scene.add(sun);

    // 5. Arena Environment
    this.environment = createDesertEnvironment(this.scene);

    // 6. Player's Rock (Width 2.4m, Height 1.38m, placed at z = -1.25)
    this.playerRock = createProceduralRock(2.4, 1.38, 1.8, 42);
    this.playerRock.position.set(0, 0.65, -1.25);
    this.scene.add(this.playerRock);

    // 7. Opponent's Rock & Opponent Avatar
    this.opponentRock = createProceduralRock(2.4, 1.38, 1.8, 99);
    this.opponentRock.position.set(0, 0.65, -this.mapDistance);
    this.scene.add(this.opponentRock);

    this.opponent = createOpponentAvatar();
    this.opponent.group.position.set(0, 0, -this.mapDistance + 0.3);
    this.scene.add(this.opponent.group);

    // 8. First-person Gun Model attached to camera
    this.fpsGun = createFirstPersonRifle();
    this.camera.add(this.fpsGun);
    this.scene.add(this.camera);

    // 9. Muzzle flash light
    this.muzzleLight = new THREE.PointLight(0xffaa22, 0, 7);
    this.muzzleLight.position.set(0.28, -0.15, -1.5);
    this.camera.add(this.muzzleLight);
  }

  setMapDistance(distance) {
    this.mapDistance = distance;
    this.opponentRock.position.z = -this.mapDistance;
    this.opponent.group.position.z = -this.mapDistance + 0.3;
  }

  initListeners() {
    this.onMouseMove = (e) => {
      if (!this.isAlive) return;

      const deltaX = e.movementX || 0;
      const deltaY = e.movementY || 0;

      const sens = this.isAiming ? this.mouseSensitivity * 0.45 : this.mouseSensitivity;

      // Update aim angles
      this.aimYaw -= deltaX * sens;
      this.aimPitch -= deltaY * sens;

      // Limit yaw & pitch range
      this.aimYaw = THREE.MathUtils.clamp(this.aimYaw, -0.65, 0.65);
      this.aimPitch = THREE.MathUtils.clamp(this.aimPitch, -0.35, 0.45);

      // Leaning / Peeking out around the boulder:
      // When aiming left -> lean body left to clear the rock!
      // When aiming right -> lean body right to clear the rock!
      // When aiming up -> raise head above the rock!
      // When aiming down / center -> duck safely behind the rock!
      this.targetLean.x = this.aimYaw * 2.2;
      this.targetLean.y = this.aimPitch * 1.4;
    };

    this.onMouseDown = (e) => {
      sounds.init();

      // Right-click: Aim Down Sights (ADS)
      if (e.button === 2) {
        this.setAiming(true);
      }
      // Left-click: Shoot!
      else if (e.button === 0) {
        this.shoot();
      }
    };

    this.onMouseUp = (e) => {
      if (e.button === 2) {
        this.setAiming(false);
      }
    };

    this.onContextMenu = (e) => {
      e.preventDefault();
    };

    this.onResize = () => {
      if (!this.container || !this.renderer) return;
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };

    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('resize', this.onResize);
  }

  setAiming(aiming) {
    if (this.isAiming === aiming) return;
    this.isAiming = aiming;
  }

  shoot() {
    if (!this.isAlive || !this.canShoot) return;

    this.canShoot = false;
    this.onBoltState(false);

    // 1. Audio
    sounds.playGunshot(false);

    // 2. Gun recoil
    this.recoil.pitch += this.isAiming ? 0.05 : 0.09;
    if (this.fpsGun) {
      this.fpsGun.position.z += 0.16;
      this.fpsGun.rotation.x += 0.1;
    }

    // 3. Muzzle flash
    this.muzzleLight.intensity = 4.0;
    setTimeout(() => {
      if (this.muzzleLight) this.muzzleLight.intensity = 0;
    }, 45);

    // 4. Raycast hit check from camera direction
    const rayDir = new THREE.Vector3();
    this.camera.getWorldDirection(rayDir);

    // Spread if hipfiring
    if (!this.isAiming) {
      rayDir.x += (Math.random() - 0.5) * 0.02;
      rayDir.y += (Math.random() - 0.5) * 0.02;
      rayDir.normalize();
    }

    this.raycaster.set(this.camera.position, rayDir);

    const targets = [
      this.playerRock,
      this.opponentRock,
      this.opponent.headMesh,
      this.opponent.torsoMesh,
    ];

    const intersects = this.raycaster.intersectObjects(targets, false);

    let endPoint = this.camera.position.clone().add(rayDir.clone().multiplyScalar(this.mapDistance + 10));

    if (intersects.length > 0) {
      const hit = intersects[0];
      endPoint = hit.point;

      // Hit our own rock?
      if (hit.object === this.playerRock) {
        sounds.playRicochet();
        this.spawnSparks(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 0, 1));
      }
      // Hit opponent's rock?
      else if (hit.object === this.opponentRock) {
        sounds.playRicochet();
        this.spawnSparks(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 0, 1));
      }
      // Hit opponent!
      else if (hit.object === this.opponent.headMesh || hit.object === this.opponent.torsoMesh) {
        const isHead = hit.object === this.opponent.headMesh;
        sounds.playHitmarker();
        this.spawnSparks(hit.point, new THREE.Vector3(0, 0, 1), 0xff2222);

        this.onKill({ isHeadshot: isHead, distance: Math.round(this.mapDistance) });
        this.opponentAlive = false;
        sounds.playVictory();
        this.animateOpponentFall();
      }
    }

    // Bullet tracer
    this.spawnTracer(this.camera.position.clone().add(new THREE.Vector3(0.18, -0.15, -0.4)), endPoint);

    // Notify multiplayer listener
    this.onShotFired({
      origin: this.camera.position.toArray(),
      direction: rayDir.toArray(),
      hitPoint: endPoint.toArray(),
    });

    // Bolt reload
    setTimeout(() => {
      sounds.playBoltCycle();
    }, 350);

    setTimeout(() => {
      this.canShoot = true;
      this.onBoltState(true);
    }, 1100);
  }

  onRemoteShot(shotData) {
    sounds.playGunshot(true);

    const origin = new THREE.Vector3(...shotData.origin);
    const endPoint = new THREE.Vector3(...shotData.hitPoint);

    this.spawnTracer(origin, endPoint);

    if (this.isAlive) {
      const rayDir = new THREE.Vector3(...shotData.direction).normalize();
      const dist = origin.distanceTo(this.camera.position);
      const closestPoint = origin.clone().add(rayDir.clone().multiplyScalar(dist));
      const headDist = closestPoint.distanceTo(this.camera.position);

      if (!this.isCovered && headDist < 0.45) {
        this.isAlive = false;
        sounds.playDefeat();
        this.onHit({ killer: 'Đối thủ' });
      }
    }
  }

  spawnTracer(start, end) {
    const material = new THREE.LineBasicMaterial({
      color: 0xffea75,
      transparent: true,
      opacity: 0.95,
    });
    const geometry = new THREE.BufferGeometry().setFromPoints([start, start.clone()]);
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    this.tracers.push({
      line,
      start,
      end,
      progress: 0,
      speed: 20.0,
    });
  }

  spawnSparks(point, normal, color = 0xffbf00) {
    const count = 12;
    const sparkGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;

      const vel = normal.clone().multiplyScalar(2 + Math.random() * 3);
      vel.x += (Math.random() - 0.5) * 2.5;
      vel.y += Math.random() * 2.5;
      vel.z += (Math.random() - 0.5) * 2.5;
      velocities.push(vel);
    }

    sparkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size: 0.14,
      transparent: true,
      opacity: 1,
    });

    const particles = new THREE.Points(sparkGeo, mat);
    this.scene.add(particles);

    this.sparks.push({ particles, velocities, life: 0.35 });
  }

  animateOpponentFall() {
    if (!this.opponent) return;
    const startTime = performance.now();
    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed < 0.6) {
        this.opponent.group.rotation.x = -elapsed * 2.2;
        this.opponent.group.position.y = -elapsed * 0.9;
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  syncRemotePlayer(remoteState) {
    if (!this.opponent || !this.opponentAlive) return;

    // Invert X for opponent perspective
    const peekX = -remoteState.peekX;
    const peekY = remoteState.peekY;

    this.opponent.headGroup.position.x = peekX;
    this.opponent.headGroup.position.y = 1.42 + peekY;

    this.opponent.torsoMesh.position.x = peekX * 0.7;
    this.opponent.torsoMesh.position.y = 0.8 + peekY * 0.7;

    this.opponent.rifleGroup.position.x = peekX + 0.22;
    this.opponent.rifleGroup.position.y = 1.15 + peekY;

    // Scope glint when aiming
    if (this.opponent.glintMesh) {
      this.opponent.glintMesh.visible = !!remoteState.isAiming;
    }
  }

  updateBot(delta) {
    if (!this.isBotMode || !this.opponentAlive || !this.isAlive) return;

    this.botState.timer -= delta;

    if (this.botState.action === 'HIDE') {
      this.botState.targetPos = { x: 0, y: -0.3 };
      if (this.opponent.glintMesh) this.opponent.glintMesh.visible = false;

      if (this.botState.timer <= 0) {
        // Pick a distinct peek direction
        const choices = [
          { x: -1.3, y: 0.15 }, // Peek Left past the rock
          { x: 1.3, y: 0.15 },  // Peek Right past the rock
          { x: 0, y: 0.45 },    // Peek Over the top of the rock
          { x: -0.9, y: 0.4 },  // Peek Top-Left
          { x: 0.9, y: 0.4 },   // Peek Top-Right
        ];
        this.botState.targetPos = choices[Math.floor(Math.random() * choices.length)];
        this.botState.action = 'PEEK';
        this.botState.timer = 2.2 + Math.random() * 1.2; // Stay visible long enough to be spotted!
        this.botState.aimDuration = 0;
      }
    } else if (this.botState.action === 'PEEK') {
      if (this.opponent.glintMesh) this.opponent.glintMesh.visible = true;

      // If player is exposed, bot starts tracking
      if (!this.isCovered) {
        this.botState.aimDuration += delta;
        if (this.botState.aimDuration >= this.botState.reactionTime) {
          this.botShoot();
          this.botState.action = 'HIDE';
          this.botState.timer = 1.6 + Math.random() * 1.0;
        }
      } else {
        if (this.botState.timer <= 0) {
          this.botState.action = 'HIDE';
          this.botState.timer = 1.2 + Math.random() * 1.2;
        }
      }
    }

    const currentX = this.opponent.headGroup.position.x;
    const currentY = this.opponent.headGroup.position.y - 1.42;

    const newX = THREE.MathUtils.lerp(currentX, this.botState.targetPos.x, delta * 6);
    const newY = THREE.MathUtils.lerp(currentY, this.botState.targetPos.y, delta * 6);

    this.syncRemotePlayer({
      peekX: -newX,
      peekY: newY,
      isAiming: this.botState.action === 'PEEK',
    });
  }

  botShoot() {
    const botOrigin = this.opponent.group.position.clone().add(new THREE.Vector3(
      this.opponent.headGroup.position.x + 0.2,
      1.3 + this.opponent.headGroup.position.y,
      0.8
    ));

    let hitPlayer = false;
    if (!this.isCovered && Math.random() < 0.8) {
      hitPlayer = true;
    }

    const endPoint = hitPlayer
      ? this.camera.position.clone()
      : this.camera.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, 0));

    sounds.playGunshot(true);
    this.spawnTracer(botOrigin, endPoint);

    if (hitPlayer && this.isAlive) {
      this.isAlive = false;
      sounds.playDefeat();
      this.onHit({ killer: 'Bot Tinh Anh' });
    } else {
      sounds.playRicochet();
      this.spawnSparks(endPoint, new THREE.Vector3(0, 0, 1));
    }
  }

  startLoop() {
    const tick = () => {
      this.animationFrameId = requestAnimationFrame(tick);
      const delta = Math.min(this.clock.getDelta(), 0.1);
      this.swayTime += delta;

      // 1. Smoothly interpolate lean offset
      this.peekOffset.x = THREE.MathUtils.lerp(this.peekOffset.x, this.targetLean.x, delta * 14);
      this.peekOffset.y = THREE.MathUtils.lerp(this.peekOffset.y, this.targetLean.y, delta * 14);

      // 2. Camera position based on lean
      // Ducked base height: 1.18m (behind rock).
      // Leaning up raises to 1.60m (over rock).
      // Leaning left/right shifts x by up to 1.4m (past rock edge).
      this.camera.position.x = this.peekOffset.x;
      this.camera.position.y = 1.18 + Math.max(0, this.peekOffset.y);
      this.camera.position.z = 0;

      // 3. Camera Rotation = Aiming angles + recoil
      this.recoil.pitch = THREE.MathUtils.lerp(this.recoil.pitch, 0, delta * 12);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.aimYaw;
      this.camera.rotation.x = this.aimPitch + this.recoil.pitch;

      // 4. Smooth FOV for ADS
      const targetFOV = this.isAiming ? 28 : 70;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, delta * 15);
      this.camera.updateProjectionMatrix();

      // 5. First-person Gun alignment
      if (this.fpsGun) {
        const swayX = Math.sin(this.swayTime * 2.5) * (this.isAiming ? 0.001 : 0.005);
        const swayY = Math.cos(this.swayTime * 5.0) * (this.isAiming ? 0.001 : 0.005);

        const targetGunPos = this.isAiming
          ? new THREE.Vector3(0, -0.145, -0.42) // Centered scope
          : new THREE.Vector3(0.28, -0.28, -0.55); // Hip position

        this.fpsGun.position.lerp(targetGunPos, delta * 16);
        this.fpsGun.position.x += swayX;
        this.fpsGun.position.y += swayY;
        this.fpsGun.rotation.x = THREE.MathUtils.lerp(this.fpsGun.rotation.x, 0, delta * 12);
      }

      // 6. Cover detection:
      // Rock half-width: ~1.15m. Rock height: ~1.35m.
      // If camera |x| > 1.1m (leaned out to side) OR camera y > 1.36m (peeking over top), player is EXPOSED!
      const isExposed = Math.abs(this.camera.position.x) > 1.05 || this.camera.position.y > 1.35;
      const newCoverState = !isExposed;
      if (newCoverState !== this.isCovered) {
        this.isCovered = newCoverState;
        this.onCoverChange(this.isCovered);
      }

      // 7. Update bullet tracers
      for (let i = this.tracers.length - 1; i >= 0; i--) {
        const t = this.tracers[i];
        t.progress += delta * t.speed;
        if (t.progress >= 1.0) {
          this.scene.remove(t.line);
          t.line.geometry.dispose();
          t.line.material.dispose();
          this.tracers.splice(i, 1);
        } else {
          const currentHead = t.start.clone().lerp(t.end, Math.min(1.0, t.progress * 1.6));
          const currentTail = t.start.clone().lerp(t.end, Math.max(0.0, t.progress * 1.6 - 0.4));
          t.line.geometry.setFromPoints([currentTail, currentHead]);
        }
      }

      // 8. Update sparks
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i];
        s.life -= delta;
        if (s.life <= 0) {
          this.scene.remove(s.particles);
          s.particles.geometry.dispose();
          s.particles.material.dispose();
          this.sparks.splice(i, 1);
        } else {
          const pos = s.particles.geometry.attributes.position;
          for (let j = 0; j < s.velocities.length; j++) {
            pos.setXYZ(
              j,
              pos.getX(j) + s.velocities[j].x * delta,
              pos.getY(j) + s.velocities[j].y * delta,
              pos.getZ(j) + s.velocities[j].z * delta
            );
            s.velocities[j].y -= 9.8 * delta;
          }
          pos.needsUpdate = true;
          s.particles.material.opacity = s.life / 0.35;
        }
      }

      // 9. Update Bot AI
      this.updateBot(delta);

      this.renderer.render(this.scene, this.camera);
    };

    tick();
  }

  resetRound() {
    this.isAlive = true;
    this.opponentAlive = true;
    this.canShoot = true;
    this.isAiming = false;
    this.onBoltState(true);

    if (this.opponent) {
      this.opponent.group.rotation.x = 0;
      this.opponent.group.position.y = 0;
      this.opponent.headGroup.position.set(0, 1.42, 0);
      this.opponent.torsoMesh.position.set(0, 0.8, 0);
    }

    if (this.isBotMode) {
      this.botState.action = 'HIDE';
      this.botState.timer = 1.2;
    }
  }

  destroy() {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('resize', this.onResize);

    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
    }
  }
}
