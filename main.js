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
  controls.target.set(0, 1, 0);
  controls.update();

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  const loader = new GLTFLoader();

  let isWPressed = false;
  let isSPressed = false;
  let wheelRotationSpeed = 0;
  const maxSpeed = 10;
  const acceleration = 0.02;
  const deceleration = 0.03;
  const speed = 0;

  let frontWheels = [];
  let backWheels = [];
  let carModel = null;

  document.addEventListener("keydown", (event) => {
    if (event.code === "KeyW") isWPressed = true;
    if (event.code === "KeyS") isSPressed = true;
  });

  document.addEventListener("keyup", (event) => {
    if (event.code === "KeyW") isWPressed = false;
    if (event.code === "KeyS") isSPressed = false;
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
    carModel.rotation.set(0, Math.PI / -2, 0);

    carModel.traverse((child) => {
      console.log("Objeto:", child.name);
    });

    const backWheelsGroup = carModel.getObjectByName("back_wheels_1");
    const frontWheelsGroup = carModel.getObjectByName("front_wheels_7");

    if (backWheelsGroup) backWheels = backWheelsGroup.children;
    if (frontWheelsGroup) frontWheels = frontWheelsGroup.children;
  });

  function animate() {
    requestAnimationFrame(animate);

    if (carModel) {
      if (isWPressed) {
        wheelRotationSpeed += acceleration;
        carModel.position.x -= 0.5;
      } else if (isSPressed) {
        wheelRotationSpeed -= deceleration;
        carModel.position.x += 0.5;
      } else {
        if (wheelRotationSpeed > 0) {
          wheelRotationSpeed = speed;
          wheelRotationSpeed -= speed / 0.2;
          carModel.position.x -= 0.3;
        }
        wheelRotationSpeed -= deceleration;
      }

      wheelRotationSpeed = Math.max(0, Math.min(wheelRotationSpeed, maxSpeed));

      frontWheels.forEach((wheel) => {
        wheel.rotation.x += wheelRotationSpeed;
      });
      backWheels.forEach((wheel) => {
        wheel.rotation.x += wheelRotationSpeed;
      });

      const carPosition = carModel.position;
      camera.position.set(carPosition.x + 5, carPosition.y + 5, carPosition.z + 10);
      camera.lookAt(carPosition.x, carPosition.y + 1, carPosition.z);
    }

    renderer.render(scene, camera);
  }

  animate();
}
main();
