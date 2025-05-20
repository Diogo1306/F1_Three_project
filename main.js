import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

main();

function main() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaaaaaa);

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

  const loader = new GLTFLoader();

  let keys = { w: false, s: false, a: false, d: false };
  const clock = new THREE.Clock();
  const desiredFPS = 120;
  const frameDuration = 1 / desiredFPS;
  let accumulator = 0;

  const velocidadeDiv = document.getElementById("velocidade");

  let speed = 0;
  const maxSpeed = 4;
  const maxReverseSpeed = -0.1;
  const acceleration = 0.01;
  const braking = 0.015;
  const friction = 0.006;
  const turnSpeed = 0.02;

  let carModel = null;
  let carRotationY = 0;
  let frontWheels = [];
  let backWheels = [];
  let steeringWheel = null;

  let frontLeftGroup, frontRightGroup;

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

  loader.load("resources/model/recetrack.glb", (gltf) => {
    const trackModel = gltf.scene;
    trackModel.position.set(0, -25, 0);
    trackModel.scale.set(3, 3, 3);
    scene.add(trackModel);
  });

  loader.load("resources/model/low_poly_f1_car.glb", (gltf) => {
    carModel = gltf.scene;
    carModel.scale.set(0.04, 0.04, 0.04);
    carModel.position.set(-200, 0, 378);
    carRotationY = Math.PI / 2;
    carModel.rotation.y = carRotationY;
    scene.add(carModel);

    const wheelFL = carModel.getObjectByName("WheelFront000");
    const wheelFR = carModel.getObjectByName("WheelFront001");
    const wheelBL = carModel.getObjectByName("WheelFront002");
    const wheelBR = carModel.getObjectByName("WheelFront003");
    steeringWheel = carModel.getObjectByName("steering_wheel_1");

    if (wheelFL && wheelFR && wheelBL && wheelBR) {
      frontLeftGroup = new THREE.Group();
      frontRightGroup = new THREE.Group();

      const parentFL = wheelFL.parent;
      const parentFR = wheelFR.parent;

      parentFL.remove(wheelFL);
      parentFR.remove(wheelFR);

      const posFL = wheelFL.position.clone();
      const posFR = wheelFR.position.clone();

      wheelFL.position.set(0, 0, 0);
      wheelFR.position.set(0, 0, 0);

      frontLeftGroup.add(wheelFL);
      frontRightGroup.add(wheelFR);

      frontLeftGroup.position.copy(posFL);
      frontRightGroup.position.copy(posFR);

      parentFL.add(frontLeftGroup);
      parentFR.add(frontRightGroup);

      frontWheels = [wheelFL, wheelFR];
      backWheels = [wheelBL, wheelBR];
    }
  });

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    accumulator += delta;
    if (accumulator < frameDuration) return;
    accumulator = 0;

    if (carModel) {
      const direction = new THREE.Vector3(-Math.sin(carRotationY), 0, -Math.cos(carRotationY));

      if (keys.w) speed += acceleration;
      else if (keys.s) speed -= braking;
      else {
        if (speed > 0) speed = Math.max(0, speed - friction);
        else if (speed < 0) speed = Math.min(0, speed + friction);
      }

      speed = Math.max(maxReverseSpeed, Math.min(speed, maxSpeed));

      if (speed !== 0) {
        const turnFactor = turnSpeed * (1 - Math.min(Math.abs(speed) / maxSpeed, 2));
        if (speed > 0) {
          if (keys.a) carRotationY += turnFactor;
          if (keys.d) carRotationY -= turnFactor;
        } else {
          if (keys.a) carRotationY -= turnFactor / 5;
          if (keys.d) carRotationY += turnFactor / 5;
        }

        if (keys.a || keys.d) speed *= 0.995;
      }

      carModel.rotation.y = carRotationY;
      carModel.position.add(direction.clone().multiplyScalar(speed));

      const wheelRotation = speed * 0.5;
      frontWheels.forEach((wheel) => (wheel.rotation.x += wheelRotation));
      backWheels.forEach((wheel) => (wheel.rotation.x += wheelRotation));

      const maxSteerAngle = 0.4;
      let steerAngle = 0;
      if (keys.a) steerAngle = maxSteerAngle;
      else if (keys.d) steerAngle = -maxSteerAngle;

      if (frontLeftGroup) frontLeftGroup.rotation.y = steerAngle;
      if (frontRightGroup) frontRightGroup.rotation.y = steerAngle;

      if (steeringWheel) {
        steeringWheel.rotation.y = steerAngle * 2;
      }

      const velocidadeKmH = (speed / maxSpeed) * 360;
      velocidadeDiv.innerText = `Velocidade: ${velocidadeKmH.toFixed(0)} km/h`;

      const carDirection = new THREE.Vector3(-Math.sin(carRotationY), 0, -Math.cos(carRotationY));
      const cameraOffset = carDirection.clone().multiplyScalar(-12);
      cameraOffset.y = 5;

      const carPos = carModel.position.clone();
      const cameraPos = carPos.clone().add(cameraOffset);

      camera.position.copy(cameraPos);
      camera.lookAt(carPos.clone().add(new THREE.Vector3(0, 2, 0)));
    }

    renderer.render(scene, camera);
  }

  animate();
}
