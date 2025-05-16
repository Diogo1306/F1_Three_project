import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

function main() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaaaaaa);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(1, 1, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  const loader = new GLTFLoader();

  let keys = { w: false, s: false, a: false, d: false };

  let speed = 0;
  const maxSpeed = 2.2;
  const maxReverseSpeed = -0.1;
  const acceleration = 0.01;
  const braking = 0.008;
  const friction = 0.006;
  const turnSpeed = 0.03;

  let frontWheels = [];
  let backWheels = [];
  let steeringWheel = null;
  let carModel = null;
  let carRotationY = Math.PI / -2;

  document.addEventListener("keydown", (event) => {
    if (event.code === "KeyW") keys.w = true;
    if (event.code === "KeyS") keys.s = true;
    if (event.code === "KeyA") keys.a = true;
    if (event.code === "KeyD") keys.d = true;
  });

  document.addEventListener("keyup", (event) => {
    if (event.code === "KeyW") keys.w = false;
    if (event.code === "KeyS") keys.s = false;
    if (event.code === "KeyA") keys.a = false;
    if (event.code === "KeyD") keys.d = false;
  });

  loader.load("resources/model/f1_bahrain_lowpoly_circuit.glb", (gltf) => {
    const skybox = gltf.scene;
    scene.add(skybox);
    skybox.position.set(0, -25, 0);
    skybox.scale.set(3, 3, 3);
  });

  loader.load("resources/model/mclaren_mp45__formula_1.glb", (gltf) => {
    carModel = gltf.scene;
    scene.add(carModel);

    carModel.position.set(-200, 0, 378);
    carModel.rotation.set(0, carRotationY, 0);

    carModel.traverse((child) => {
      if (child.name) {
        console.log(`Nome: ${child.name}`);
      }
    });

    const backWheelsGroup = carModel.getObjectByName("back_wheels_1");
    const frontWheelsGroup = carModel.getObjectByName("front_wheels_7");
    const steeringWheel = carModel.getObjectByName("steering_wheel_1");

    if (backWheelsGroup) backWheels = backWheelsGroup.children;
    if (frontWheelsGroup) frontWheels = frontWheelsGroup.children;
  });

  function animate() {
    requestAnimationFrame(animate);

    if (carModel) {
      if (keys.w) {
        speed += acceleration;
      } else if (keys.s) {
        speed -= braking;
      } else {
        if (speed > 0) {
          speed -= friction;
          if (speed < 0) speed = 0;
        } else if (speed < 0) {
          speed += friction;
          if (speed > 0) speed = 0;
        }
      }

      speed = Math.max(maxReverseSpeed, Math.min(speed, maxSpeed));

      if (speed !== 0) {
        const turnFactor = turnSpeed * (1 - Math.min(Math.abs(speed) / maxSpeed, 2));
        if (speed > 0) {
          if (keys.a) carRotationY += turnFactor + 0.004;
          if (keys.d) carRotationY -= turnFactor + 0.004;
        } else {
          if (keys.a) carRotationY -= turnFactor / 5;
          if (keys.d) carRotationY += turnFactor / 5;
        }
        if (keys.a || keys.d) {
          speed *= 0.995;
        }
      }

      carModel.rotation.y = carRotationY;

      const direction = new THREE.Vector3(Math.sin(carRotationY), 0, Math.cos(carRotationY));
      carModel.position.add(direction.multiplyScalar(speed));

      const wheelRotation = speed * 0.5;
      frontWheels.forEach((wheel) => (wheel.rotation.x += wheelRotation));
      backWheels.forEach((wheel) => (wheel.rotation.x += wheelRotation));

      const cameraOffset = new THREE.Vector3(Math.sin(carRotationY), 0, Math.cos(carRotationY)).multiplyScalar(-12);
      cameraOffset.y = 5;

      const carPos = carModel.position.clone();
      camera.position.copy(carPos.clone().add(cameraOffset));
      camera.lookAt(carPos.clone().add(new THREE.Vector3(0, 2, 0)));
    }

    renderer.render(scene, camera);
  }

  animate();
}

main();
