import * as THREE from "three";
import * as CANNON from "cannon-es";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import CannonDebugger from "cannon-es-debugger";

const keys = { w: false, s: false, a: false, d: false, " ": false };

main();

function main() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });

  const groundMaterial = new CANNON.Material("ground");
  const wheelMaterial = new CANNON.Material("wheel");
  const contactMaterial = new CANNON.ContactMaterial(groundMaterial, wheelMaterial, {
    friction: 0.3,
    restitution: 0.3,
  });
  world.defaultContactMaterial.friction = 0.4;
  world.addContactMaterial(contactMaterial);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaaaaaa);

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
  const rayHelpers = [];
  let carWrapper = null;

  const gltfLoader = new GLTFLoader();

  gltfLoader.load("resources/models/cartoon_race_track_spielberg.glb", (gltf) => {
    const track = gltf.scene;
    track.scale.set(1, 1, 1);
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
    carModel.scale.set(0.02, 0.02, 0.02);
    carModel.rotation.y = Math.PI;

    carWrapper = new THREE.Object3D();
    carWrapper.add(carModel);
    carModel.position.set(0, -0.35, 0);
    scene.add(carWrapper);

    const wheelFL = carModel.getObjectByName("WheelFront000");
    const wheelFR = carModel.getObjectByName("WheelFront001");
    const wheelBL = carModel.getObjectByName("WheelFront002");
    const wheelBR = carModel.getObjectByName("WheelFront003");

    [wheelFL, wheelFR, wheelBL, wheelBR].forEach((w) => (w.visible = true));

    const spawnY = 1.0;
    chassisBody = new CANNON.Body({
      mass: 1200,
      position: new CANNON.Vec3(-23, spawnY, 2.2),
      quaternion: new CANNON.Quaternion().setFromEuler(0, -Math.PI / 2, 0), // rotação
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

      const offset = new THREE.Vector3(0, 2.5, -5).applyQuaternion(carWrapper.quaternion);
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

      const force = 6000;
      const steer = 0.4;

      const brakeForce = 3000;

      if (keys[" "]) {
        for (let i = 0; i < 4; i++) vehicle.setBrake(brakeForce, i);
      } else {
        for (let i = 0; i < 4; i++) vehicle.setBrake(0, i);
      }

      if (keys.w) {
        vehicle.applyEngineForce(-force, 2);
        vehicle.applyEngineForce(-force, 3);
      }
      if (keys.s) {
        vehicle.applyEngineForce(force, 3);
        vehicle.applyEngineForce(force, 3);
      }
      if (keys.a) {
        vehicle.setSteeringValue(steer, 0);
        vehicle.setSteeringValue(steer, 1);
      } else if (keys.d) {
        vehicle.setSteeringValue(-steer, 0);
        vehicle.setSteeringValue(-steer, 1);
      } else {
        vehicle.setSteeringValue(0, 0);
        vehicle.setSteeringValue(0, 1);
      }
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
