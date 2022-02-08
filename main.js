import * as THREE from "three";
import * as CANNON from "cannon";

let camera, scene, renderer; // threejs globals
let world; // Cannonjs world
const originalBoxSize = 3; // Original width and height of the box

let stack = [];
let overhangs = [];
const boxHeight = 1;

let gameStarted = false;

function init() {
  // Initialize Cannon.js
  world = new CANNON.World();
  world.gravity.set(0, -10, 0); // gravity pulls things down
  world.broadphase;

  scene = new THREE.Scene();

  //  Foundation
  addLayer(0, 0, originalBoxSize, originalBoxSize);

  // First Layer
  addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");

  // set up lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // we use this to have a base color for our shape, color is usually white along with intensity should be around 0.5 for the two lights
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6); // shines to everything at the same angle like a sun for a specific position we have pointlight or spotlight
  directionalLight.position.set(10, 20, 0); // right side recieves less light and upper area more if there wasn't ambient light we would be unable to see the front side
  scene.add(directionalLight);

  //Camera
  const width = 10;
  const height = width * (window.innerHeight / window.innerWidth);
  camera = new THREE.OrthographicCamera(
    width / -2, // left
    width / 2, // right
    height / 2, // top
    height / -2, // bottom
    1, // near
    100 //far
  );
  camera.position.set(4, 4, 4); // these numbers don't matter the objects will appear the same size
  camera.lookAt(0, 0, 0);

  //Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
  document.body.appendChild(renderer.domElement);
}

function addLayer(x, z, width, depth, direction) {
  const y = boxHeight * stack.length; // Add the new box one layer higher (calculating the y position/coordinate)
  const layer = generateBox(x, y, z, width, depth, false);
  layer.direction = direction;
  stack.push(layer);
}

function addOverhang(x, z, width, depth) {
  const y = boxHeight * (stack.length - 1); // we don't want to move it one layer higher we want to keep it on the same layer
  const overhang = generateBox(x, y, z, width, depth, true);
  overhangs.push(overhang);
}

function generateBox(x, y, z, width, depth, falls) {
  const geometry = new THREE.BoxGeometry(width, boxHeight, depth);
  const color = new THREE.Color(`hsl(${30 + stack.length * 4},100%,50%)`); // we start at 30deg and with every layer we add 4deg to it
  const material = new THREE.MeshLambertMaterial({ color }); // MeshLabertMaterial takes light into consideration unlike MeshBasicMaterial(we don't see the edges of the box clearly), some advanced materials have costly calculations making the game slower
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  scene.add(mesh);

  // CannonJS
  const shape = new CANNON.Box(
    new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2)
  ); // setting the distance from the center of the box to its sides
  let mass = falls ? 5 : 0;
  const body = new CANNON.Body({ mass, shape });
  body.position.set(x, y, z); // just like threejs
  world.addBody(body);

  return {
    threejs: mesh,
    cannonjs: body,
    width,
    depth,
  };
}

function updatePhysics(){
  world.step(1 / 60) // Step the physics world because of 60fps

  // copy coordinates from cannon.js to three.js
  overhangs.forEach((element) => {
    element.threejs.position.copy(element.cannonjs.position)
    element.threejs.quaternion.copy(element.cannonjs.quaternion)
  })
}

function cutBox(topLayer,overlap,size,delta){
  
  // Cut layer
    const direction = topLayer.direction
      const newWidth = direction === "x" ? overlap : topLayer.width;
      const newDepth = direction === "z" ? overlap : topLayer.depth;

      // Update metadata
      topLayer.width = newWidth;
      topLayer.depth = newDepth;

      // Update THREEJS model
      topLayer.threejs.scale[direction] = overlap / size; // changes the size of the mesh keeping the center at the same position
      topLayer.threejs.position[direction] -= delta / 2;

      // Update CannonJS model
      topLayer.cannonjs.position[direction] -= delta / 2

      // Replace shape to a smaller one (in CannonJS you can't just simply scale a shape)
      const shape = new CANNON.Box(new CANNON.Vec3(newWidth / 2, boxHeight / 2, newDepth / 2))
      topLayer.cannonjs.shapes = []
      topLayer.cannonjs.addShape(shape)

      return {
        newWidth,
        newDepth
      }
}

window.addEventListener("click", () => {
  if (!gameStarted) {
    renderer.setAnimationLoop(animation); // similar to requestAnimationFrame but it only runs once we have to keep calling it to have a loop but setAnimationLoop runs until we stop it explicitly
    gameStarted = true;
  } else {
    const topLayer = stack[stack.length - 1];
    const previousLayer = stack[stack.length - 2];

    const direction = topLayer.direction;

    const delta =
      topLayer.threejs.position[direction] -
      previousLayer.threejs.position[direction];
    const overhangSize = Math.abs(delta);
    const size = direction === "x" ? topLayer.width : topLayer.depth;
    const overlap = size - overhangSize;

    if (overlap > 0) {
      // // We need to split the box
      // // Cut layer
      // const newWidth = direction === "x" ? overlap : topLayer.width;
      // const newDepth = direction === "z" ? overlap : topLayer.depth;

      // // Update metadata
      // topLayer.width = newWidth;
      // topLayer.depth = newDepth;

      // // Update THREEJS model
      // topLayer.threejs.scale[direction] = overlap / size; // changes the size of the mesh keeping the center at the same position
      // topLayer.threejs.position[direction] -= delta / 2;

     const { newWidth,newDepth } = cutBox(topLayer,overlap,size,delta)

      // Overhang
      const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta); // -7.5
      const overhangX =
        direction === "x"
          ? topLayer.threejs.position.x + overhangShift
          : topLayer.threejs.position.x;
      const overhangZ =
        direction === "z"
          ? topLayer.threejs.position.z + overhangShift
          : topLayer.threejs.position.z;
      const overhangWidth = direction === "x" ? overhangSize : newWidth;
      const overhangDepth = direction === "z" ? overhangSize : newDepth;

      addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);

      // Next layer
      const nextX = direction === "x" ? topLayer.threejs.position.x : -10;
      const nextZ = direction === "z" ? topLayer.threejs.position.z : -10;
      const nextDirection = direction === "x" ? "z" : "x";

      addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);
    }
  }
});

function animation() {
  // console.log('inside anmation') will keep calling endlessly
  const speed = 0.15;

  const topLayer = stack[stack.length - 1];
  topLayer.threejs.position[topLayer.direction] += speed;
  topLayer.cannonjs.position[topLayer.direction] += speed; // updating cannonjs model as well

  // 4 is the initial camera height
  if (camera.position.y < boxHeight * (stack.length - 2) + 4) {
    camera.position.y += speed;
  }
  updatePhysics()
  renderer.render(scene, camera);
}

init();
