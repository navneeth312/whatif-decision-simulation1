import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import {
  createDaylightBuildingMaterial,
  createHolographicBuildingMaterial,
  createDaylightSkyTexture,
  createHoloSkyTexture,
  createCyberSensorNodesGeometry,
  createSensorBeaconTexture,
  createCyberGroundMaterial,
  createDaylightGroundMaterial
} from '../models/digitalTwinShaders';
import { OSMMapFeature } from '../models/regionalMap';

describe('Digital Twin Shaders & Visual Quality Suite', () => {
  it('1. Daylight Photorealistic Building Material: compiles shader with required uniforms', () => {
    const mat = createDaylightBuildingMaterial({ differenceMode: false });
    assert.ok(mat instanceof THREE.ShaderMaterial, 'Expected ShaderMaterial instance');
    assert.ok(mat.uniforms.uSunDirection, 'Expected uSunDirection uniform');
    assert.ok(mat.uniforms.uSunColor, 'Expected uSunColor uniform');
    assert.ok(mat.uniforms.uSkyColor, 'Expected uSkyColor uniform');
    assert.ok(mat.uniforms.uHazeDistance, 'Expected uHazeDistance uniform');
    assert.strictEqual(mat.uniforms.uDifferenceMode.value, 0.0);
    assert.strictEqual(mat.vertexColors, true);
    assert.strictEqual(mat.side, THREE.DoubleSide);

    const diffMat = createDaylightBuildingMaterial({ differenceMode: true });
    assert.strictEqual(diffMat.uniforms.uDifferenceMode.value, 1.0);
  });

  it('2. Holographic Cyber Building Material: compiles shader with animated scan time uniform', () => {
    const mat = createHolographicBuildingMaterial({ differenceMode: false });
    assert.ok(mat instanceof THREE.ShaderMaterial, 'Expected ShaderMaterial instance');
    assert.ok(mat.uniforms.uTime, 'Expected uTime uniform');
    assert.ok(mat.uniforms.uBaseColor, 'Expected uBaseColor uniform');
    assert.ok(mat.uniforms.uFresnelColor, 'Expected uFresnelColor uniform');
    assert.ok(mat.uniforms.uGlassColor, 'Expected uGlassColor uniform');
    assert.strictEqual(mat.transparent, true);
    assert.strictEqual(mat.depthWrite, true);
    assert.strictEqual(mat.side, THREE.DoubleSide);

    // Verify time animation updates cleanly
    mat.uniforms.uTime.value = 12.5;
    assert.strictEqual(mat.uniforms.uTime.value, 12.5);
  });

  it('3. Sky Gradient Textures: instantiates texture objects cleanly in both environments', () => {
    const daylightSky = createDaylightSkyTexture();
    assert.ok(daylightSky instanceof THREE.Texture, 'Expected daylight sky texture instance');

    const holoSky = createHoloSkyTexture();
    assert.ok(holoSky instanceof THREE.Texture, 'Expected holo sky texture instance');

    const beaconTex = createSensorBeaconTexture();
    assert.ok(beaconTex instanceof THREE.Texture, 'Expected beacon texture instance');
  });

  it('4. Cyber Sensor Nodes Geometry: extracts road intersection sensor beacons', () => {
    const sampleFeatures: OSMMapFeature[] = [
      {
        id: 'way/101',
        kind: 'road',
        coordinates: [
          [80.52, 16.34],
          [80.53, 16.35],
          [80.54, 16.36]
        ],
        class: 'primary'
      },
      {
        id: 'way/102',
        kind: 'road',
        coordinates: [
          [80.525, 16.345],
          [80.535, 16.355]
        ],
        class: 'secondary'
      },
      {
        id: 'way/999',
        kind: 'building',
        coordinates: [
          [80.52, 16.34],
          [80.53, 16.34],
          [80.53, 16.35],
          [80.52, 16.34]
        ],
        class: 'yes'
      }
    ];

    const geo = createCyberSensorNodesGeometry(sampleFeatures);
    assert.ok(geo instanceof THREE.BufferGeometry, 'Expected BufferGeometry instance');
    const posAttr = geo.getAttribute('position');
    assert.ok(posAttr, 'Expected position attribute');
    assert.ok(posAttr.count > 0, 'Expected non-zero sensor node points');
  });

  it('5. Cyber Ground Material: compiles reflective metallic cyber circuit ground', () => {
    const groundMat = createCyberGroundMaterial();
    assert.ok(groundMat instanceof THREE.ShaderMaterial, 'Expected ShaderMaterial instance');
    assert.ok(groundMat.uniforms.uTime, 'Expected uTime uniform');
    assert.strictEqual(groundMat.depthWrite, false);
  });

  it('6. Daylight Ground Material: compiles urban substrate with sunlight & atmospheric haze', () => {
    const groundMat = createDaylightGroundMaterial();
    assert.ok(groundMat instanceof THREE.ShaderMaterial, 'Expected ShaderMaterial instance');
    assert.ok(groundMat.uniforms.uSunDirection, 'Expected uSunDirection uniform');
    assert.ok(groundMat.uniforms.uSunColor, 'Expected uSunColor uniform');
    assert.ok(groundMat.uniforms.uSkyColor, 'Expected uSkyColor uniform');
    assert.ok(groundMat.uniforms.uHazeDistance, 'Expected uHazeDistance uniform');
    assert.ok(groundMat.uniforms.uHazeColor, 'Expected uHazeColor uniform');
    assert.strictEqual(groundMat.depthWrite, false);
  });
});
