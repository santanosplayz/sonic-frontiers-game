// ========================================
// SONIC FRONTIERS 3D GAME ENGINE
// ========================================

// Global Variables
let scene, camera, renderer, world, player, levels = [], currentLevelIndex = 0;
let loadedModel = null, uploadedAnimations = {};
const keys = {};
let mouseDown = false, mouseX = 0, mouseY = 0;
let playerSpeed = 0, playerVelocity = new THREE.Vector3();
const MAX_SPEED = 0.5;
const ACCELERATION = 0.02;
const FRICTION = 0.95;

// ========================================
// INITIALIZATION
// ========================================

function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 0, 500);

    // Camera setup
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        10000
    );
    camera.position.set(0, 20, 50);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    const canvas = document.getElementById('canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowShadowMap;

    // Physics world setup
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    world.defaultContactMaterial.friction = 0.4;

    // Lighting
    setupLighting();

    // Player setup
    player = createPlayer();
    scene.add(player.mesh);

    // Create levels
    createLevels();
    loadLevel(0);

    // UI setup
    setupUI();

    // Event listeners
    setupEventListeners();

    // Hide loading screen
    setTimeout(() => {
        document.getElementById('loadingScreen').style.display = 'none';
    }, 1000);

    // Start animation loop
    animate();
}

// ========================================
// LIGHTING
// ========================================

function setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Directional light (sun)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.camera.left = -500;
    dirLight.shadow.camera.right = 500;
    dirLight.shadow.camera.top = 500;
    dirLight.shadow.camera.bottom = -500;
    scene.add(dirLight);
    scene.add(dirLight.target);

    // Hemispheric light
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0xffffff, 0.4);
    scene.add(hemiLight);
}

// ========================================
// PLAYER SETUP
// ========================================

function createPlayer() {
    const group = new THREE.Group();

    // Player body (capsule)
    const geometry = new THREE.CapsuleGeometry(1, 2, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0x0099ff });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.4, 0.5, 1);
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.4, 0.5, 1);
    group.add(leftEye);
    group.add(rightEye);

    // Physics body
    const shape = new CANNON.Sphere(1);
    const playerBody = new CANNON.Body({ mass: 1, shape });
    playerBody.linearDamping = 0.3;
    world.addBody(playerBody);

    group.position.set(0, 10, 0);
    group.castShadow = true;
    group.receiveShadow = true;

    return {
        mesh: group,
        body: playerBody,
        speed: 0,
        isJumping: false,
        health: 100,
        rings: 0,
        animations: {},
        currentAnimation: 'idle'
    };
}

// ========================================
// LEVEL CREATION
// ========================================

function createLevels() {
    const levelConfigs = [
        { name: 'Green Valley', color: 0x2ecc71, difficulty: 'Easy' },
        { name: 'Blue Ocean', color: 0x3498db, difficulty: 'Easy' },
        { name: 'Red Desert', color: 0xe74c3c, difficulty: 'Medium' },
        { name: 'Purple Mountains', color: 0x9b59b6, difficulty: 'Medium' },
        { name: 'Orange Caverns', color: 0xe67e22, difficulty: 'Hard' },
        { name: 'Cyan Crystals', color: 0x1abc9c, difficulty: 'Hard' },
        { name: 'Dark Abyss', color: 0x34495e, difficulty: 'Very Hard' },
        { name: 'Golden Temple', color: 0xf39c12, difficulty: 'Very Hard' },
        { name: 'Silver Peak', color: 0xbdc3c7, difficulty: 'Extreme' },
        { name: 'Rainbow Paradise', color: 0xff69b4, difficulty: 'Extreme' }
    ];

    levelConfigs.forEach((config, index) => {
        levels.push({
            index,
            name: config.name,
            color: config.color,
            difficulty: config.difficulty,
            mesh: null,
            platforms: [],
            enemies: [],
            rings: [],
            checkpoint: null
        });
    });
}

function loadLevel(levelIndex) {
    // Remove previous level from scene
    if (levels[currentLevelIndex].mesh) {
        scene.remove(levels[currentLevelIndex].mesh);
    }

    currentLevelIndex = levelIndex;
    const level = levels[levelIndex];

    // Create level terrain
    generateLevelTerrain(level);
    scene.add(level.mesh);

    // Reset player
    player.mesh.position.set(0, 10, 0);
    player.body.velocity.set(0, 0, 0);
    player.health = 100;
    player.rings = 0;
    player.isJumping = false;

    // Update HUD
    document.getElementById('currentLevel').textContent = levelIndex + 1;
    updateLevelButtonStates();

    // Reset camera
    camera.position.set(0, 20, 50);
}

function generateLevelTerrain(level) {
    const levelGroup = new THREE.Group();

    // Main platform
    const platformGeometry = new THREE.BoxGeometry(100, 2, 100);
    const platformMaterial = new THREE.MeshStandardMaterial({ color: level.color });
    const mainPlatform = new THREE.Mesh(platformGeometry, platformMaterial);
    mainPlatform.position.y = -2;
    mainPlatform.castShadow = true;
    mainPlatform.receiveShadow = true;
    levelGroup.add(mainPlatform);

    // Add physics body for main platform
    const groundShape = new CANNON.Box(new CANNON.Vec3(50, 1, 50));
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.position.set(0, -2, 0);
    world.addBody(groundBody);

    // Floating platforms
    const platformCount = 8 + level.index * 2;
    for (let i = 0; i < platformCount; i++) {
        const x = (Math.random() - 0.5) * 150;
        const y = 5 + Math.random() * 30;
        const z = (Math.random() - 0.5) * 150;
        const size = 5 + Math.random() * 5;

        const floatPlatform = new THREE.Mesh(
            new THREE.BoxGeometry(size, 1, size),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        floatPlatform.position.set(x, y, z);
        floatPlatform.castShadow = true;
        floatPlatform.receiveShadow = true;
        levelGroup.add(floatPlatform);

        // Physics
        const platformShape = new CANNON.Box(new CANNON.Vec3(size / 2, 0.5, size / 2));
        const platformBody = new CANNON.Body({ mass: 0 });
        platformBody.addShape(platformShape);
        platformBody.position.set(x, y, z);
        world.addBody(platformBody);

        level.platforms.push(floatPlatform);
    }

    // Add rings
    const ringCount = 50 + level.index * 10;
    for (let i = 0; i < ringCount; i++) {
        const ring = createRing();
        ring.position.set(
            (Math.random() - 0.5) * 200,
            5 + Math.random() * 40,
            (Math.random() - 0.5) * 200
        );
        levelGroup.add(ring);
        level.rings.push(ring);
    }

    // Add enemies
    const enemyCount = 3 + Math.floor(level.index / 2);
    for (let i = 0; i < enemyCount; i++) {
        const enemy = createEnemy();
        enemy.position.set(
            (Math.random() - 0.5) * 150,
            20 + Math.random() * 20,
            (Math.random() - 0.5) * 150
        );
        levelGroup.add(enemy);
        level.enemies.push(enemy);
    }

    // Goal/Checkpoint
    const checkpoint = createCheckpoint();
    checkpoint.position.set(0, 10, -80);
    levelGroup.add(checkpoint);
    level.checkpoint = checkpoint;

    level.mesh = levelGroup;
}

function createRing() {
    const geometry = new THREE.TorusGeometry(0.5, 0.1, 8, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0xffd700 });
    const ring = new THREE.Mesh(geometry, material);
    ring.castShadow = true;
    ring.receiveShadow = true;
    ring.collected = false;
    return ring;
}

function createEnemy() {
    const geometry = new THREE.OctahedronGeometry(1);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const enemy = new THREE.Mesh(geometry, material);
    enemy.castShadow = true;
    enemy.receiveShadow = true;
    enemy.health = 30;
    enemy.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        0,
        (Math.random() - 0.5) * 0.1
    );
    return enemy;
}

function createCheckpoint() {
    const geometry = new THREE.CylinderGeometry(3, 3, 2, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00aa00 });
    const checkpoint = new THREE.Mesh(geometry, material);
    checkpoint.castShadow = true;
    checkpoint.receiveShadow = true;
    checkpoint.reached = false;
    return checkpoint;
}

// ========================================
// COLLISION & INTERACTION
// ========================================

function updateCollisions() {
    // Check ring collection
    const level = levels[currentLevelIndex];
    level.rings.forEach(ring => {
        if (!ring.collected) {
            const distance = player.mesh.position.distanceTo(ring.position);
            if (distance < 3) {
                ring.collected = true;
                scene.remove(ring);
                player.rings += 10;
                document.getElementById('ringCount').textContent = player.rings;
            }
        }
    });

    // Check checkpoint
    if (level.checkpoint && !level.checkpoint.reached) {
        const distance = player.mesh.position.distanceTo(level.checkpoint.position);
        if (distance < 5) {
            level.checkpoint.reached = true;
            level.checkpoint.material.color.set(0xffff00);
            console.log('Level Complete! Moving to next level...');
            setTimeout(() => {
                const nextLevel = (currentLevelIndex + 1) % levels.length;
                loadLevel(nextLevel);
            }, 2000);
        }
    }

    // Check enemy collision
    level.enemies.forEach(enemy => {
        const distance = player.mesh.position.distanceTo(enemy.position);
        if (distance < 4) {
            player.health -= 10;
            player.mesh.position.y += 5;
            document.getElementById('playerHealth').textContent = Math.max(0, player.health);
            if (player.health <= 0) {
                loadLevel(currentLevelIndex);
            }
        }
    });
}

// ========================================
// PLAYER CONTROLS
// ========================================

function updatePlayerMovement() {
    const direction = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();

    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    cameraDirection.normalize();

    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(camera.up, cameraDirection).normalize();

    if (keys['w'] || keys['W']) {
        direction.addScaledVector(cameraDirection, 1);
    }
    if (keys['s'] || keys['S']) {
        direction.addScaledVector(cameraDirection, -1);
    }
    if (keys['d'] || keys['D']) {
        direction.addScaledVector(cameraRight, 1);
    }
    if (keys['a'] || keys['A']) {
        direction.addScaledVector(cameraRight, -1);
    }

    if (direction.length() > 0) {
        direction.normalize();
        player.body.velocity.x = direction.x * MAX_SPEED * 50;
        player.body.velocity.z = direction.z * MAX_SPEED * 50;
        player.currentAnimation = 'run';
    } else {
        player.body.velocity.x *= FRICTION;
        player.body.velocity.z *= FRICTION;
        player.currentAnimation = 'idle';
    }

    // Jump
    if (keys[' '] && !player.isJumping) {
        player.body.velocity.y = 15;
        player.isJumping = true;
        player.currentAnimation = 'jump';
    }

    // Dash
    if (keys['Shift']) {
        player.body.velocity.x *= 1.5;
        player.body.velocity.z *= 1.5;
        player.currentAnimation = 'dash';
    }

    player.mesh.position.copy(player.body.position);

    // Update HUD speed
    const speed = Math.sqrt(player.body.velocity.x ** 2 + player.body.velocity.z ** 2) * 0.5;
    document.getElementById('playerSpeed').textContent = Math.floor(speed);
}

function updatePlayerJumpState() {
    const raycaster = new THREE.Raycaster(
        player.mesh.position,
        new THREE.Vector3(0, -1, 0),
        0,
        2
    );

    const level = levels[currentLevelIndex];
    const objects = [level.checkpoint, ...level.platforms];
    const intersects = raycaster.intersectObjects(objects);

    if (intersects.length > 0) {
        player.isJumping = false;
    }
}

// ========================================
// CAMERA CONTROLS
// ========================================

function updateCamera() {
    if (mouseDown) {
        const sensitivity = 0.005;
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(camera.quaternion);
        euler.rotateY(-mouseX * sensitivity);
        euler.rotateX(-mouseY * sensitivity);
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
    }

    // Follow player
    const targetPos = player.mesh.position.clone();
    targetPos.y += 15;

    const cameraDir = camera.position.clone().sub(targetPos).normalize();
    const desiredPos = targetPos.clone().addScaledVector(cameraDir, 50);

    camera.position.lerp(desiredPos, 0.1);
    camera.lookAt(targetPos.x, targetPos.y - 5, targetPos.z);
}

// ========================================
// MODEL UPLOAD & ANIMATION
// ========================================

window.uploadModel = function() {
    const fileInput = document.getElementById('modelFile');
    const modelName = document.getElementById('modelName').value || 'Custom Model';
    const statusDiv = document.getElementById('uploadStatus');

    if (!fileInput.files.length) {
        statusDiv.textContent = '❌ Please select a file';
        statusDiv.style.color = '#ff6600';
        return;
    }

    const file = fileInput.files[0];
    statusDiv.textContent = '⏳ Loading...';
    statusDiv.style.color = '#00d4ff';

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const loader = new THREE.GLTFLoader();
            loader.parse(event.target.result, '', function(gltf) {
                loadedModel = gltf.scene;
                loadedModel.scale.set(2, 2, 2);
                loadedModel.position.set(30, 10, 0);

                // Extract animations
                if (gltf.animations && gltf.animations.length > 0) {
                    uploadedAnimations = {};
                    gltf.animations.forEach((clip, index) => {
                        uploadedAnimations[clip.name] = clip;
                    });
                    statusDiv.textContent = `✅ Loaded! Animations: ${Object.keys(uploadedAnimations).join(', ')}`;
                } else {
                    statusDiv.textContent = '✅ Model loaded (no animations)';
                }
                statusDiv.style.color = '#00ff00';
            });
        } catch (error) {
            statusDiv.textContent = '❌ Error loading model';
            statusDiv.style.color = '#ff6600';
            console.error(error);
        }
    };
    reader.readAsArrayBuffer(file);
};

window.playAnimation = function(animationName) {
    if (uploadedAnimations[animationName]) {
        console.log(`Playing animation: ${animationName}`);
        player.currentAnimation = animationName;
    } else {
        console.log(`Animation '${animationName}' not available`);
    }
};

// ========================================
// UI SETUP
// ========================================

function setupUI() {
    const levelSelect = document.getElementById('levelSelect');
    levels.forEach((level, index) => {
        const btn = document.createElement('button');
        btn.textContent = `L${index + 1}: ${level.name}`;
        btn.className = 'level-btn';
        if (index === 0) btn.classList.add('active');
        btn.onclick = () => loadLevel(index);
        levelSelect.appendChild(btn);
    });
}

function updateLevelButtonStates() {
    const buttons = document.querySelectorAll('.level-btn');
    buttons.forEach((btn, index) => {
        if (index === currentLevelIndex) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    window.addEventListener('keydown', (e) => {
        keys[e.key] = true;
    });

    window.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });

    document.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            mouseDown = true;
            document.body.style.cursor = 'none';
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            mouseDown = false;
            document.body.style.cursor = 'auto';
        }
    });

    document.addEventListener('mousemove', (e) => {
        mouseX = e.movementX;
        mouseY = e.movementY;
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            mouseDown = false;
            document.body.style.cursor = 'auto';
        }
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// ========================================
// ANIMATION LOOP
// ========================================

function animate() {
    requestAnimationFrame(animate);

    // Update physics
    world.step(1 / 60);

    // Update player
    updatePlayerMovement();
    updatePlayerJumpState();
    updateCamera();
    updateCollisions();

    // Update enemies
    const level = levels[currentLevelIndex];
    level.enemies.forEach(enemy => {
        enemy.position.addScaledVector(enemy.velocity, 1);
        enemy.rotation.x += 0.01;
        enemy.rotation.y += 0.02;

        // Bounce off boundaries
        if (Math.abs(enemy.position.x) > 100) enemy.velocity.x *= -1;
        if (Math.abs(enemy.position.z) > 100) enemy.velocity.z *= -1;
    });

    // Rotate rings
    level.rings.forEach(ring => {
        if (!ring.collected) {
            ring.rotation.x += 0.02;
            ring.rotation.y += 0.03;
            ring.position.y += Math.sin(Date.now() * 0.001) * 0.01;
        }
    });

    // Render
    renderer.render(scene, camera);
}

// ========================================
// START
// ========================================

window.addEventListener('load', init);