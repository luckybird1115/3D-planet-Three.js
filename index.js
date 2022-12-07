// New scene and camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 25;

// https://stackoverflow.com/questions/16319742/three-js-rotating-a-sphere-around-a-certain-axis
const rotateAxis = new THREE.Vector3(0, 1, 0);
const rotateAngle = 0.005; // radian

// New Renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Enable controls
const controls = new THREE.TrackballControls(camera);

// Create a sphere to make visualization easier.
const earthRadius = 10;
const planet = new THREE.Object3D();
const geometry = new THREE.SphereGeometry(earthRadius, 32, 32);
const material = new THREE.MeshBasicMaterial({
  color: 0x343a40,
  wireframe: false,
  transparent: false
});

const sphere = new THREE.Mesh(geometry, material);
planet.add(sphere);
scene.add(planet);

// parsing the GeoJSON world map onto the planet
drawThreeGeo(
  geodata,
  earthRadius,
  "sphere",
  {
    color: 0xffffff
  },
  planet
);

// FORMAT - city : [latitude, longitude]
const geocodes = {
  dublin: [53.3498, -6.2603],
  rome: [41.890251, 12.492373],
  "new york": [40.7128, -74.006],
  "los angeles": [34.0522, -118.2437],
  sydney: [-33.865143, 151.2099],
  christchurch: [-43.5321, 172.6362],
  xinghua: [32.9105, 119.8525],
  rosario: [-32.9442, -60.6505],
  captown: [-33.92584, 18.42322],
  mumbai: [19.228825, 72.854118],
  volgograd: [48.700001, 44.516666],
  tokyo: [35.652832, 139.839478],
  riyadh: [24.774265, 46.738586],
  vancouver: [49.279793, -123.115669],
  panama: [8.983333, -79.51667],
  "kuala lumpur": [3.152815, 101.703651],
  "north pole": [90, 180],
  "south pole": [-90, 90]
};

// convert 2D coordinates to threejs Vector3 object
// Watch out the different order of latitude and longitude in GeoJSON and GoogleMap, see https://macwright.org/lonlat/
function geocodesToVector3(city) {
  const lat = geocodes[city][0];
  const lon = geocodes[city][1];
  const r = earthRadius;
  // follow the conversion of drawLine(y, z, x) in drawThreeGeo() in ThreeGeoJSON.js
  const x =
    Math.cos((lat * Math.PI) / 180) * Math.cos((lon * Math.PI) / 180) * r;
  const y =
    Math.cos((lat * Math.PI) / 180) * Math.sin((lon * Math.PI) / 180) * r;
  const z = Math.sin((lat * Math.PI) / 180) * r;
  return new THREE.Vector3(y, z, x);
}

function createSplineDots(origin, destination) {
  // THREE object that contains a particle system with animated dots along a curve
  const splineDots = new THREE.Object3D();

  const start = geocodesToVector3(origin);
  const end = geocodesToVector3(destination);

  // make a bezier curve between start (origin) and end (destination)
  const distanceBetweenCountryCenter = start.distanceTo(end);

  const mid = start.clone().lerp(end, 0.5);
  const midLength = mid.length();

  mid.normalize();
  mid.multiplyScalar(midLength + distanceBetweenCountryCenter * 0.55);
  const normal = new THREE.Vector3().subVectors(start, end);
  normal.normalize();

  /*
                The curve looks like this:

                midStartAnchor---- mid ----- midEndAnchor
              /                                           \
             /                                             \
            /                                               \
    start/anchor                                         end/anchor

        splineCurveA                            splineCurveB
    */

  const distanceHalf = distanceBetweenCountryCenter * 0.5;
  const startAnchor = start;
  const midStartAnchor = mid
    .clone()
    .add(normal.clone().multiplyScalar(distanceHalf));
  const midEndAnchor = mid
    .clone()
    .add(normal.clone().multiplyScalar(-distanceHalf));
  const endAnchor = end;

  //  now make a bezier curve out of the above like so in the diagram
  const splineCurveA = new THREE.CubicBezierCurve3(
    start,
    startAnchor,
    midStartAnchor,
    mid
  );
  const splineCurveB = new THREE.CubicBezierCurve3(
    mid,
    midEndAnchor,
    endAnchor,
    end
  );

  //  how many vertices do we want on this guy? this is for *each* side
  const vertexCountDesired =
    Math.floor(distanceBetweenCountryCenter * 0.3 + 6) * 2;

  //  collect the vertices
  let points = splineCurveA.getPoints(vertexCountDesired);

  //  remove the very last point since it will be duplicated on the next half of the curve
  points = points.splice(0, points.length - 1);
  points = points.concat(splineCurveB.getPoints(vertexCountDesired - 1)); // Watch out: curve.getPoints(n) will return n+1 points in three.js

  // a helper function, see https://github.com/zz85/ThreeLabs/blob/master/spline3editor.html
  THREE.Curve.Utils.createLineGeometry = function (points) {
    const geometry = new THREE.Geometry();
    for (let i = 0; i < points.length; i++) {
      geometry.vertices.push(points[i]);
    }
    return geometry;
  };

  // const curveGeometry = THREE.Curve.Utils.createLineGeometry(points)
  // const curveMaterial = new THREE.LineBasicMaterial({ color: 0x212529 }) // 0xffffff
  // const curve = new THREE.Line(curveGeometry, curveMaterial)
  // splineDots.add(curve)

  // animate dots moving along the curve
  const numParticles = vertexCountDesired * 2; // dots moving along the curve, constrained by the number of points
  const animationPoints = points;

  const particleGeometry = new THREE.Geometry();
  for (let i = 0; i < numParticles; i++) {
    const desiredIndex = (i / numParticles) * animationPoints.length;
    const rIndex = constrain(
      Math.floor(desiredIndex),
      0,
      animationPoints.length - 1
    );
    let particle = new THREE.Vector3();
    particle = animationPoints[rIndex].clone();
    particle.moveIndex = rIndex;
    particle.nextIndex = rIndex + 1;
    if (particle.nextIndex >= animationPoints.length) {
      particle.nextIndex = 0;
    }
    particle.lerpN = 0;
    particle.path = animationPoints;
    particleGeometry.vertices.push(particle);
  }

  const pMaterial = new THREE.ParticleBasicMaterial({
    color: 0x56ccf2,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    size: 0.1
  });

  const particles = new THREE.ParticleSystem(particleGeometry, pMaterial);
  particles.sortParticles = true;
  particles.dynamic = true;

  splineDots.add(particles);

  particles.update = function () {
    for (const i in this.geometry.vertices) {
      if (i < this.geometry.vertices.length) {
        const particle = this.geometry.vertices[i];
        const path = particle.path;

        particle.lerpN += 0.05;
        if (particle.lerpN > 1) {
          particle.lerpN = 0;
          particle.moveIndex = particle.nextIndex;
          particle.nextIndex++;
          if (particle.nextIndex >= path.length) {
            particle.moveIndex = 0;
            particle.nextIndex = 1;
          }
        }

        const currentPoint = path[particle.moveIndex];
        const nextPoint = path[particle.nextIndex];

        particle.copy(currentPoint);
        particle.lerp(nextPoint, particle.lerpN);
      }
    }
    this.geometry.verticesNeedUpdate = true;
  };
  return splineDots;
}

const cities = [];
cities.push(
  createSplineDots("dublin", "rome"),
  createSplineDots("dublin", "new york"),
  createSplineDots("dublin", "los angeles"),
  createSplineDots("dublin", "sydney"),
  createSplineDots("dublin", "rosario"),
  createSplineDots("dublin", "captown"),
  createSplineDots("dublin", "tokyo"),
  createSplineDots("dublin", "vancouver"),
  createSplineDots("dublin", "panama"),
  createSplineDots("dublin", "kuala lumpur")
);

for (let i = 0; i < cities.length; i++) {
  scene.add(cities[i]);
}

function constrain(v, min, max) {
  if (v < min) v = min;
  else if (v > max) v = max;
  return v;
}

function render() {
  renderer.render(scene, camera);
  requestAnimationFrame(render);

  // auto rotating
  planet.rotateOnAxis(rotateAxis, rotateAngle);
  for (let i = 0; i < cities.length; i++) {
    cities[i].rotateOnAxis(rotateAxis, rotateAngle);
  }

  controls.update();
  scene.traverse(function (mesh) {
    if (mesh.update !== undefined) {
      mesh.update();
    }
  });
}

render();
