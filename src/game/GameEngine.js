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

    this.mapDistance = options.mapDistance || 35; // 18 (Near), 35 (Mid), 60 (Far)
    this.isBotMode = options.isBotMode ?? true;

    // Game state
    this.isAlive = true;
    this.opponentAlive = true;
    this.isAiming = false;
    this.canShoot = true;
    this.isCovered = true;
    
    // Continuous Mouse Peek Offset (-1.5 to +1.5 horizontally, -0.6 to +1.2 vertically)
    this.peekOffset = { x: 0, y: 0 };
    this.targetPeek = { x: 0, y: 0 };
    this.mouseSensitivity = 0.0035;

    // View recoil & sway
    this.recoil = { pitch: 0, yaw: 0 };
    this.swayTime = 0;

    // Raycaster for hit detection
    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();

    // Active visual effects (bullet tracers, sparks)
    this.tracers = [];
    this.sparks = [];

    // Bot AI state
    this.botState = {
      action: 'HIDE', // HIDE, PEEK, AIM, SHOT
      timer: 1.5,
      peekTarget: { x: 0, y: 0 },
      aimDuration: 0,
      reactionTime: 0.65, // seconds before bot fires when player is exposed
    };

    this.initScene();
    this.initListeners();
    this.startLoop();
  }

  initScene() {
    // 1. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // 2. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd9b48f); // Warm desert haze
    this.scene.fog = new THREE.FogExp2(0xd9b48f, 0.012);

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      500
    );
    this.baseCamPos = new THREE.Vector3(0, 1.45, 0); // Behind player's rock
    this.camera.position.copy(this.baseCamPos);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffecd2, 0.7);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.8);
    sunLight.position.set(40, 60, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 150;
    const d = 50;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    this.scene.add(sunLight);

    // 5. Arena Environment
    this.environment = createDesertEnvironment(this.scene, this.mapDistance);

    // 6. Player's Rock (Positioned at Z = -1.8, directly sheltering player)
    this.playerRock = createProceduralRock(3.8, 3.1, 2.6, 42);
    this.playerRock.position.set(0, 1.1, -1.8);
    this.scene.add(this.playerRock);

    // 7. Opponent's Rock & Opponent Avatar
    this.opponentRock = createProceduralRock(3.8, 3.1, 2.6, 99);
    this.opponentRock.position.set(0, 1.1, -this.mapDistance);
    this.scene.add(this.opponentRock);

    this.opponent = createOpponentAvatar();
    this.opponent.group.position.set(0, 0, -this.mapDistance + 0.35);
    // Face towards the player
    this.opponent.group.rotation.y = 0;
    this.scene.add(this.opponent.group);

    // 8. First-person Gun Model attached to camera
    this.fpsGun = createFirstPersonRifle();
    this.camera.add(this.fpsGun);
    this.scene.add(this.camera);

    // 9. Muzzle flash light
    this.muzzleLight = new THREE.PointLight(0xffaa22, 0, 8);
    this.muzzleLight.position.set(0.3, -0.2, -1.8);
    this.camera.add(this.muzzleLight);
  }

  setMapDistance(distance) {
    this.mapDistance = distance;
    this.opponentRock.position.z = -this.mapDistance;
    this.opponent.group.position.z = -this.mapDistance + 0.35;
  }

  // Pointer lock & Mouse handling
  initListeners() {
    this.onMouseMove = (e) => {
      if (!this.isAlive) return;

      const deltaX = e.movementX || 0;
      const deltaY = e.movementY || 0;

      // Sensitivity factor (reduced when ADS aiming for precision)
      const sens = this.isAiming ? this.mouseSensitivity * 0.45 : this.mouseSensitivity;

      // Shift target peek offset continuously in any direction
      this.targetPeek.x += deltaX * sens;
      this.targetPeek.y -= deltaY * sens; // Invert Y so moving mouse up leans up

      // Clamp continuous peek boundary (ellipse around rock)
      const maxHorizontal = 1.65;
      const maxUp = 1.05;
      const maxDown = -0.45;

      this.targetPeek.x = THREE.MathUtils.clamp(this.targetPeek.x, -maxHorizontal, maxHorizontal);
      this.targetPeek.y = THREE.MathUtils.clamp(this.targetPeek.y, maxDown, maxUp);
    };

    this.onMouseDown = (e) => {
      // Audio resume on first user interaction
      sounds.init();

      // Right-click: Aim down sights (ADS)
      if (e.button === 2) {
        this.setAiming(true);
      }
      // Left-click: Fire bullet!
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
      e.preventDefault(); // Prevent browser right-click context menu
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

  // Shoot weapon
  shoot() {
    if (!this.isAlive || !this.canShoot) return;

    this.canShoot = false;
    this.onBoltState(false); // Reloading bolt

    // 1. Play sound
    sounds.playGunshot(false);

    // 2. Recoil kick
    this.recoil.pitch += this.isAiming ? 0.08 : 0.14;
    this.recoil.yaw += (Math.random() - 0.5) * 0.04;
    if (this.fpsGun) {
      this.fpsGun.position.z += 0.18; // Kick back
      this.fpsGun.rotation.x += 0.12;
    }

    // 3. Muzzle flash
    this.muzzleLight.intensity = 4.0;
    setTimeout(() => {
      if (this.muzzleLight) this.muzzleLight.intensity = 0;
    }, 45);

    // 4. Hit Detection via Raycasting
    // Origin is camera position, direction is straight ahead with slight recoil
    const rayDir = new THREE.Vector3(0, 0, -1);
    rayDir.applyQuaternion(this.camera.quaternion);

    // Apply minor hipfire spread if not aiming
    if (!this.isAiming) {
      rayDir.x += (Math.random() - 0.5) * 0.025;
      rayDir.y += (Math.random() - 0.5) * 0.025;
      rayDir.normalize();
    }

    this.raycaster.set(this.camera.position, rayDir);

    // Check hit against: Player's Rock (blocked?), Opponent's Rock, Opponent's Head/Body
    const targets = [
      this.playerRock,
      this.opponentRock,
      this.opponent.headMesh,
      this.opponent.torsoMesh
    ];

    const intersects = this.raycaster.intersectObjects(targets, false);

    let endPoint = this.camera.position.clone().add(rayDir.clone().multiplyScalar(this.mapDistance + 10));
    let hitSomething = false;

    if (intersects.length > 0) {
      const hit = intersects[0];
      endPoint = hit.point;
      hitSomething = true;

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
      // Hit opponent (Headshot or Body)!
      else if (hit.object === this.opponent.headMesh || hit.object === this.opponent.torsoMesh) {
        const isHead = hit.object === this.opponent.headMesh;
        sounds.playHitmarker();
        this.spawnSparks(hit.point, new THREE.Vector3(0, 0, 1), 0xff2222); // Red hit spark

        this.onKill({ isHeadshot: isHead, distance: Math.round(this.mapDistance) });
        this.opponentAlive = false;
        sounds.playVictory();

        // Animate opponent falling
        this.animateOpponentFall();
      }
    }

    // Spawn bullet tracer
    this.spawnTracer(this.camera.position.clone().add(new THREE.Vector3(0.2, -0.2, -0.5)), endPoint);

    // Notify multiplayer listener
    this.onShotFired({
      origin: this.camera.position.toArray(),
      direction: rayDir.toArray(),
      hitPoint: endPoint.toArray()
    });

    // 5. Bolt action reload cycle (~1.1s)
    setTimeout(() => {
      sounds.playBoltCycle();
    }, 350);

    setTimeout(() => {
      this.canShoot = true;
      this.onBoltState(true); // Ready to fire again!
    }, 1100);
  }

  // Remote/Opponent fired weapon
  onRemoteShot(shotData) {
    sounds.playGunshot(true);

    const origin = new THREE.Vector3(...shotData.origin);
    const endPoint = new THREE.Vector3(...shotData.hitPoint);

    this.spawnTracer(origin, endPoint);

    // Check if the remote shot hits our exposed player!
    if (this.isAlive) {
      // Test if local player is exposed and ray is close to player head
      const rayDir = new THREE.Vector3(...shotData.direction).normalize();
      const distToPlayer = origin.distanceTo(this.camera.position);
      const closestPointOnRay = origin.clone().add(rayDir.clone().multiplyScalar(distToPlayer));
      
      const headDist = closestPointOnRay.distanceTo(this.camera.position);

      // If we are not covered and ray passes within 0.35m of head
      if (!this.isCovered && headDist < 0.38) {
        this.isAlive = false;
        sounds.playDefeat();
        this.onHit({ killer: 'Opponent' });
      }
    }
  }

  // Spawn visual bullet tracer
  spawnTracer(start, end) {
    const material = new THREE.LineBasicMaterial({
      color: 0xffe680,
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
    });
    const geometry = new THREE.BufferGeometry().setFromPoints([start, start.clone()]);
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    this.tracers.push({
      line,
      start,
      end,
      progress: 0,
      speed: 18.0, // fast bullet streak
    });
  }

  // Spawn spark burst on rock impact
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
      vel.x += (Math.random() - 0.5) * 3;
      vel.y += Math.random() * 2.5;
      vel.z += (Math.random() - 0.5) * 3;
      velocities.push(vel);
    }

    sparkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size: 0.15,
      transparent: true,
      opacity: 1,
    });

    const particles = new THREE.Points(sparkGeo, mat);
    this.scene.add(particles);

    this.sparks.push({ particles, velocities, life: 0.35 });
  }

  animateOpponentFall() {
    if (!this.opponent) return;
    // Tumble backward
    const startTime = performance.now();
    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed < 0.6) {
        this.opponent.group.rotation.x = -elapsed * 2.2;
        this.opponent.group.position.y = -elapsed * 0.8;
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  // Sync remote player's peek and aim
  syncRemotePlayer(remoteState) {
    if (!this.opponent || !this.opponentAlive) return;

    // remoteState: { peekX, peekY, isAiming }
    const peekX = -remoteState.peekX; // Mirror horizontal for opposing perspective
    const peekY = remoteState.peekY;

    // Move opponent's head and rifle
    this.opponent.headGroup.position.x = peekX;
    this.opponent.headGroup.position.y = 1.5 + peekY;

    this.opponent.torsoMesh.position.x = peekX * 0.65;
    this.opponent.torsoMesh.position.y = 0.85 + peekY * 0.65;

    this.opponent.rifleGroup.position.x = peekX + 0.22;
    this.opponent.rifleGroup.position.y = 1.25 + peekY;
  }

  // Update Bot AI (Solo Practice Mode)
  updateBot(delta) {
    if (!this.isBotMode || !this.opponentAlive || !this.isAlive) return;

    this.botState.timer -= delta;

    if (this.botState.action === 'HIDE') {
      // Return to safety behind rock
      this.botState.peekTarget = { x: 0, y: -0.3 };
      if (this.botState.timer <= 0) {
        // Choose random peek direction around rock
        const directions = [
          { x: 1.15, y: 0.1 },  // Peek right
          { x: -1.15, y: 0.1 }, // Peek left
          { x: 0, y: 0.95 },    // Peek over top
          { x: 0.9, y: 0.8 },   // Peek top-right
          { x: -0.9, y: 0.8 },  // Peek top-left
        ];
        this.botState.peekTarget = directions[Math.floor(Math.random() * directions.length)];
        this.botState.action = 'PEEK';
        this.botState.timer = 1.2 + Math.random() * 1.5;
        this.botState.aimDuration = 0;
      }
    } else if (this.botState.action === 'PEEK') {
      // If player is exposed, bot starts tracking
      if (!this.isCovered) {
        this.botState.aimDuration += delta;
        if (this.botState.aimDuration >= this.botState.reactionTime) {
          // Bot fires!
          this.botShoot();
          this.botState.action = 'HIDE';
          this.botState.timer = 1.5 + Math.random() * 1.0;
        }
      } else {
        // Player hidden, bot peeks around then hides
        if (this.botState.timer <= 0) {
          this.botState.action = 'HIDE';
          this.botState.timer = 1.0 + Math.random() * 1.8;
        }
      }
    }

    // Smoothly interpolate bot avatar to target
    const currentX = this.opponent.headGroup.position.x;
    const currentY = this.opponent.headGroup.position.y - 1.5;

    const newX = THREE.MathUtils.lerp(currentX, this.botState.peekTarget.x, delta * 7);
    const newY = THREE.MathUtils.lerp(currentY, this.botState.peekTarget.y, delta * 7);

    this.syncRemotePlayer({
      peekX: -newX,
      peekY: newY,
      isAiming: this.botState.action === 'PEEK',
    });
  }

  botShoot() {
    // Sound & Tracer from bot
    const botOrigin = this.opponent.group.position.clone().add(new THREE.Vector3(
      this.opponent.headGroup.position.x + 0.2,
      1.3 + this.opponent.headGroup.position.y,
      0.8
    ));

    // Bot shoots at player
    let hitPlayer = false;
    // 70% accuracy when player is out in open
    if (!this.isCovered && Math.random() < 0.75) {
      hitPlayer = true;
    }

    const endPoint = hitPlayer
      ? this.camera.position.clone()
      : this.camera.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 0));

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

  // Main animation frame loop
  startLoop() {
    const tick = () => {
      this.animationFrameId = requestAnimationFrame(tick);
      const delta = Math.min(this.clock.getDelta(), 0.1);
      this.swayTime += delta;

      // 1. Smoothly interpolate local player's continuous peek offset
      this.peekOffset.x = THREE.MathUtils.lerp(this.peekOffset.x, this.targetPeek.x, delta * 12);
      this.peekOffset.y = THREE.MathUtils.lerp(this.peekOffset.y, this.targetPeek.y, delta * 12);

      // 2. Camera position based on peek
      this.camera.position.x = this.baseCamPos.x + this.peekOffset.x;
      this.camera.position.y = this.baseCamPos.y + this.peekOffset.y;
      this.camera.position.z = this.baseCamPos.z;

      // 3. Smooth FOV zoom for ADS
      const targetFOV = this.isAiming ? 32 : 75;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, delta * 14);
      this.camera.updateProjectionMatrix();

      // 4. Recover from recoil
      this.recoil.pitch = THREE.MathUtils.lerp(this.recoil.pitch, 0, delta * 10);
      this.recoil.yaw = THREE.MathUtils.lerp(this.recoil.yaw, 0, delta * 10);

      // 5. Look at opponent rock with recoil & breathing sway
      const lookTarget = new THREE.Vector3(0, 1.45, -this.mapDistance);
      this.camera.lookAt(lookTarget);
      this.camera.rotation.x += this.recoil.pitch;
      this.camera.rotation.y += this.recoil.yaw;

      // 6. First person gun sway and ADS alignment
      if (this.fpsGun) {
        const swayX = Math.sin(this.swayTime * 2) * (this.isAiming ? 0.002 : 0.008);
        const swayY = Math.cos(this.swayTime * 4) * (this.isAiming ? 0.002 : 0.008);

        // Position: hipfire vs ADS alignment
        const targetGunPos = this.isAiming
          ? new THREE.Vector3(0, -0.165, -0.45) // Centered scope view
          : new THREE.Vector3(0.32, -0.32, -0.6); // Hipfire lower-right

        this.fpsGun.position.lerp(targetGunPos, delta * 15);
        this.fpsGun.position.x += swayX;
        this.fpsGun.position.y += swayY;
        this.fpsGun.rotation.x = THREE.MathUtils.lerp(this.fpsGun.rotation.x, 0, delta * 12);
      }

      // 7. Check if player's head is behind cover or exposed!
      // Rock width is ~3.8, height is ~3.1
      // Safe zone is roughly |x| < 0.75 and y < 0.45
      const isExposed = Math.abs(this.peekOffset.x) > 0.78 || this.peekOffset.y > 0.48;
      const newCoverState = !isExposed;
      if (newCoverState !== this.isCovered) {
        this.isCovered = newCoverState;
        this.onCoverChange(this.isCovered);
      }

      // 8. Update bullet tracers
      for (let i = this.tracers.length - 1; i >= 0; i--) {
        const t = this.tracers[i];
        t.progress += delta * t.speed;
        if (t.progress >= 1.0) {
          this.scene.remove(t.line);
          t.line.geometry.dispose();
          t.line.material.dispose();
          this.tracers.splice(i, 1);
        } else {
          const currentHead = t.start.clone().lerp(t.end, Math.min(1.0, t.progress * 1.8));
          const currentTail = t.start.clone().lerp(t.end, Math.max(0.0, t.progress * 1.8 - 0.4));
          t.line.geometry.setFromPoints([currentTail, currentHead]);
        }
      }

      // 9. Update spark particles
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
            s.velocities[j].y -= 9.8 * delta; // gravity
          }
          pos.needsUpdate = true;
          s.particles.material.opacity = s.life / 0.35;
        }
      }

      // 10. Update Bot AI
      this.updateBot(delta);

      // Render frame
      this.renderer.render(this.scene, this.camera);
    };

    tick();
  }

  // Reset round for rematch
  resetRound() {
    this.isAlive = true;
    this.opponentAlive = true;
    this.targetPeek = { x: 0, y: 0 };
    this.peekOffset = { x: 0, y: 0 };
    this.canShoot = true;
    this.isAiming = false;
    this.onBoltState(true);

    if (this.opponent) {
      this.opponent.group.rotation.x = 0;
      this.opponent.group.position.y = 0;
      this.opponent.headGroup.position.set(0, 1.5, 0);
      this.opponent.torsoMesh.position.set(0, 0.85, 0);
    }

    if (this.isBotMode) {
      this.botState.action = 'HIDE';
      this.botState.timer = 1.5;
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
