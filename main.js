import * as THREE from "three";
import * as CANNON from "cannon-es";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import CannonDebugger from "cannon-es-debugger";

const keys = { w: false, s: false, a: false, d: false, " ": false };

let wheelFL = null;
let wheelFR = null;
let wheelBL = null;
let wheelBR = null;
let originalFL = null;
let originalFR = null;

main();

function main() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });

  const groundMaterial = new CANNON.Material("ground");
  const wheelMaterial = new CANNON.Material("wheel");
  const contactMaterial = new CANNON.ContactMaterial(groundMaterial, wheelMaterial, {
    friction: 1,
    restitution: 0.001,
  });
  world.defaultContactMaterial.friction = 0.4;
  world.addContactMaterial(contactMaterial);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x151729);

  function createTrimesh(geometry) {
    const posAttr = geometry.getAttribute("position");
    const indexAttr = geometry.getIndex();
    if (!posAttr || !indexAttr) return null;
    const positions = posAttr.array;
    const indices = indexAttr.array;
    if (!positions || !indices || positions.length === 0 || indices.length === 0) return null;
    for (let i = 0; i < positions.length; i++) {
      if (isNaN(positions[i])) return null;
    }
    return new CANNON.Trimesh(Array.from(positions), Array.from(indices));
  }

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, -10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enabled = false;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  const clock = new THREE.Clock();
  let animateModel = null;

  let carModel = null;
  let chassisBody = null;
  let isReady = false;
  let vehicle = null;
  let carWrapper = null;

  const cannonDebugger = new CannonDebugger(scene, world, {
    color: 0x00ff00,
  });

  const gltfLoader = new GLTFLoader();

  gltfLoader.load("resources/models/cartoon_race_track_spielberg.glb", (gltf) => {
    const track = gltf.scene;
    track.scale.set(2, 2, 2);
    scene.add(track);

    track.updateMatrixWorld(true);
    track.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geometry = child.geometry.clone();
        geometry.applyMatrix4(child.matrixWorld);
        const shape = createTrimesh(geometry);
        if (shape) {
          const body = new CANNON.Body({ mass: 0, material: groundMaterial });
          body.addShape(shape);
          world.addBody(body);
        }
      }
    });
  });

  gltfLoader.load("resources/models/low_poly_f1_car.glb", (gltf) => {
    carModel = gltf.scene;
    carModel.scale.set(0.04, 0.04, 0.04);
    carModel.rotation.y = Math.PI;

    carWrapper = new THREE.Object3D();
    carModel.visible = true;
    carWrapper.add(carModel);
    carModel.position.set(0, -0.35, 0);
    scene.add(carWrapper);

    originalFL = carModel.getObjectByName("WheelFront000");
    originalFR = carModel.getObjectByName("WheelFront001");

    wheelFL = new THREE.Object3D();
    wheelFR = new THREE.Object3D();

    wheelFL.position.copy(originalFL.position);
    wheelFR.position.copy(originalFR.position);

    originalFL.position.set(0, 0, 0);
    originalFR.position.set(0, 0, 0);

    carModel.add(wheelFL);
    carModel.add(wheelFR);

    wheelFL.add(originalFL);
    wheelFR.add(originalFR);

    wheelBL = carModel.getObjectByName("WheelFront002");
    wheelBR = carModel.getObjectByName("WheelFront003");

    [originalFL, originalFR, wheelBL, wheelBR].forEach((w) => (w.visible = true));

    const spawnY = 1.0;
    chassisBody = new CANNON.Body({
      mass: 1200,
      position: new CANNON.Vec3(-23, spawnY, 2.2),
      quaternion: new CANNON.Quaternion().setFromEuler(0, -Math.PI / 2, 0),
      shape: new CANNON.Box(new CANNON.Vec3(0.6, 0.15, 1.25)),
    });
    world.addBody(chassisBody);

    vehicle = new CANNON.RaycastVehicle({
      chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    const wheelPositions = [
      new CANNON.Vec3(-0.6, 0.15, 1.1),
      new CANNON.Vec3(0.6, 0.15, 1.1),
      new CANNON.Vec3(-0.6, 0.15, -1.1),
      new CANNON.Vec3(0.6, 0.15, -1.1),
    ];

    const wheelOptions = {
      radius: 0.2,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 60,
      suspensionRestLength: 0.045,
      suspensionMaxLength: 0.2,
      frictionSlip: 2.5,
      dampingRelaxation: 2.0,
      dampingCompression: 4.5,
      maxSuspensionForce: 100000,
      rollInfluence: 0.05,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      maxSuspensionTravel: 0.08,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
      forwardAcceleration: 1,
      sideAcceleration: 1,
      isFrontWheel: true,
    };

    wheelPositions.forEach((pos) => {
      wheelOptions.chassisConnectionPointLocal = pos.clone();
      vehicle.addWheel({ ...wheelOptions });
    });

    vehicle.addToWorld(world);

    animateModel = () => {
      carWrapper.position.copy(chassisBody.position);
      carWrapper.quaternion.copy(chassisBody.quaternion);
      const offset = new THREE.Vector3(0, 3.5, -10).applyQuaternion(carWrapper.quaternion);
      camera.position.copy(carWrapper.position).add(offset);
      camera.lookAt(carWrapper.position);
    };

    isReady = true;
  });

  function animate() {
    requestAnimationFrame(animate);
    if (!isReady) return;

    const delta = clock.getDelta();
    world.step(1 / 120, delta);

    if (vehicle && carModel) {
      animateModel();

      const velocity = chassisBody.velocity;
      const localVelocity = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
      const chassisQuaternion = new THREE.Quaternion(
        chassisBody.quaternion.x,
        chassisBody.quaternion.y,
        chassisBody.quaternion.z,
        chassisBody.quaternion.w
      );
      localVelocity.applyQuaternion(chassisQuaternion.clone().invert());

      const speed = velocity.length();
      const direction = Math.sign(localVelocity.z);
      const rotationSpeed = -direction * speed * 0.1;

      if (originalFL && originalFR && wheelBL && wheelBR) {
        originalFL.rotation.x += rotationSpeed;
        originalFR.rotation.x += rotationSpeed;
        wheelBL.rotation.x += rotationSpeed;
        wheelBR.rotation.x += rotationSpeed;
      }

      const force = 6000;
      const steer = 0.4;
      const brakeForce = 3000;
      const autoBrake = 10;

      if (chassisBody.position.y < -5) {
        chassisBody.velocity.setZero();
        chassisBody.angularVelocity.setZero();
        chassisBody.position.set(-23, 1.0, 2.2);
        chassisBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
      }

      for (let i = 0; i < 4; i++) vehicle.setBrake(0, i);

      const forward = keys.w;
      const backward = keys.s;
      const left = keys.a;
      const right = keys.d;
      const braking = keys[" "];

      if (braking) {
        for (let i = 0; i < 4; i++) vehicle.setBrake(brakeForce, i);
      }

      if (forward) {
        vehicle.applyEngineForce(-force, 2);
        vehicle.applyEngineForce(-force, 3);
      } else if (backward) {
        vehicle.applyEngineForce(force * 6, 2);
        vehicle.applyEngineForce(force * 6, 3);
      } else {
        vehicle.applyEngineForce(0, 2);
        vehicle.applyEngineForce(0, 3);
        vehicle.setBrake(autoBrake, 2);
        vehicle.setBrake(autoBrake, 3);
      }

      if (left) {
        vehicle.setSteeringValue(steer, 0);
        vehicle.setSteeringValue(steer, 1);
      } else if (right) {
        vehicle.setSteeringValue(-steer, 0);
        vehicle.setSteeringValue(-steer, 1);
      } else {
        vehicle.setSteeringValue(0, 0);
        vehicle.setSteeringValue(0, 1);
      }

      if (wheelFL && wheelFR) {
        const maxSteerAngle = Math.PI / 6;
        let steerVisual = 0;
        if (left) steerVisual = maxSteerAngle;
        else if (right) steerVisual = -maxSteerAngle;
        wheelFL.rotation.z = steerVisual;
        wheelFR.rotation.y = steerVisual;
      }
    }

    if (chassisBody) {
      const velocity = chassisBody.velocity;
      const speed = velocity.length();
      const kmh = Math.min(speed * 3.6, 360);
      document.getElementById("speedometer").innerText = `Velocidade: ${kmh.toFixed(0)} km/h`;
    }

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = true;
  });

  window.addEventListener("keyup", (e) => {
    if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = false;
  });
}
