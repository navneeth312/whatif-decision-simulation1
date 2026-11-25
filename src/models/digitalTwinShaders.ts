import * as THREE from 'three';
import { GeographicBounds, isCoordinateWithinBounds, getFeatureCoordinates, geographicToWorld, OSMMapFeature } from './regionalMap';

/**
 * Creates dynamic aerial atmospheric sky gradient texture for Daylight Normal 3D mode.
 * Mimics Blackshark.ai / Maxar realistic aerial photography with warm sunlit horizon haze.
 */
export function createDaylightSkyTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    return new THREE.Texture();
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.00, '#2563eb'); // Deep atmospheric blue at zenith
  grad.addColorStop(0.35, '#60a5fa'); // Natural daylight sky blue
  grad.addColorStop(0.68, '#93c5fd'); // Soft aerial cyan-blue
  grad.addColorStop(0.86, '#fed7aa'); // Warm golden sun haze at horizon
  grad.addColorStop(0.96, '#fef3c7'); // Soft sunlit rim
  grad.addColorStop(1.00, '#e2e8f0'); // Neutral terrain blend
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates deep cybernetic command center sky gradient texture for Holographic 3D mode.
 * Mimics high-contrast holographic digital twin with electric cyan horizon glow.
 */
export function createHoloSkyTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    return new THREE.Texture();
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.00, '#01050e'); // Deep cyber void at zenith
  grad.addColorStop(0.40, '#010b18'); // Midnight sapphire
  grad.addColorStop(0.75, '#02142a'); // Deep cyber atmospheric fill
  grad.addColorStop(0.90, '#032242'); // Subtle soft glow near horizon
  grad.addColorStop(1.00, '#010714'); // Ground blend matching cyber ground
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates glowing radial halo sprite texture for IoT sensor beacon nodes.
 */
export function createSensorBeaconTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    return new THREE.Texture();
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0.0, '#ffffff'); // Bright white-hot center
  grad.addColorStop(0.2, '#fef08a'); // Radiant golden-amber core
  grad.addColorStop(0.5, '#f59e0b'); // Warm glowing amber rim
  grad.addColorStop(0.8, 'rgba(245, 158, 11, 0.25)'); // Outer halo
  grad.addColorStop(1.0, 'rgba(245, 158, 11, 0)'); // Falloff
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates dark reflective metallic cyber ground material for Hologram mode.
 * Renders glowing coordinate grid lines, circuit bus traces, and subtle metallic sheen
 * matching Benchmark Image 2.
 */
export function createCyberGroundMaterial(): THREE.ShaderMaterial {
  const vert = /* glsl */ `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const frag = /* glsl */ `
    uniform float uTime;
    varying vec3 vWorldPosition;

    void main() {
      vec2 coord = vWorldPosition.xz;
      
      // Base dark obsidian sapphire ground
      vec3 base = vec3(0.012, 0.038, 0.082);
      
      // Primary coordinate grid (~80m physical)
      vec2 grid80 = abs(fract(coord * 2.5) - 0.5);
      float line80 = smoothstep(0.05, 0.0, min(grid80.x, grid80.y));

      // Secondary micro-grid lines (~16m physical)
      vec2 grid16 = abs(fract(coord * 12.5) - 0.5);
      float line16 = smoothstep(0.06, 0.0, min(grid16.x, grid16.y));

      // Major circuit bus conduits (~400m physical)
      vec2 grid400 = abs(fract(coord * 0.5) - 0.5);
      float line400 = smoothstep(0.035, 0.0, min(grid400.x, grid400.y));

      // Circuit node junctions at grid intersections
      float junction = smoothstep(0.14, 0.02, length(grid80));

      // Color blending
      vec3 darkCyan = vec3(0.015, 0.28, 0.45);
      vec3 brightCyan = vec3(0.00, 0.94, 1.0);
      vec3 amberNode = vec3(0.98, 0.75, 0.22);

      vec3 col = base;
      col += darkCyan * line16 * 0.35;
      col += brightCyan * line80 * 0.65;
      col += brightCyan * line400 * 1.15;
      col += amberNode * junction * 0.75;

      // Soft distance horizon blend into deep void
      float dist = length(cameraPosition.xz - coord);
      float fade = smoothstep(65.0, 18.0, dist);
      col = mix(vec3(0.003, 0.008, 0.018), col, fade);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }
    },
    vertexShader: vert,
    fragmentShader: frag,
    depthWrite: false
  });
}

/**
 * Daylight Photorealistic Urban Ground Material:
 * Replaces plain flat white surface with realistic warm urban ground,
 * subtle city street blocks, pavement substrate, and atmospheric horizon haze.
 */
export function createDaylightGroundMaterial(): THREE.ShaderMaterial {
  const vert = /* glsl */ `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const frag = /* glsl */ `
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;
    uniform vec3 uHazeColor;
    uniform float uHazeDistance;

    varying vec3 vWorldPosition;

    float groundHash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 coord = vWorldPosition.xz;

      // Realistic warm earthy urban terrain base (replaces plain white surface)
      // Ground substrate calibrated to authentic urban earth/asphalt tones
      vec3 baseEarth = vec3(0.35, 0.33, 0.29);
      vec3 streetAsphalt = vec3(0.18, 0.20, 0.22);
      vec3 parkVegetation = vec3(0.24, 0.32, 0.18);

      // Multi-scale procedural street grid and city block structure
      vec2 grid60 = abs(fract(coord * 3.3) - 0.5);
      float streetLine = smoothstep(0.08, 0.02, min(grid60.x, grid60.y));

      // Macro-scale landscape zoning (open fields/parks vs built-up blocks)
      float zoningHash = groundHash(floor(coord * 0.75));
      vec3 substrate = mix(baseEarth, parkVegetation, step(0.68, zoningHash) * 0.55);

      // Natural earth / pavement surface noise variation
      float noise = groundHash(floor(coord * 45.0)) * 0.08;

      // Combine warm substrate stone with street corridor grid
      vec3 albedo = mix(substrate * (0.95 + noise), streetAsphalt, streetLine * 0.75);

      // Sunlight and hemispherical sky fill
      vec3 sunDir = normalize(uSunDirection);
      float NdotL = max(0.0, dot(vec3(0.0, 1.0, 0.0), sunDir));
      vec3 sunLight = uSunColor * NdotL * 0.85;
      vec3 ambientFill = uSkyColor * 0.45;

      vec3 litColor = albedo * (sunLight + ambientFill);

      // Soft aerial atmospheric horizon haze
      float dist = length(cameraPosition.xz - coord);
      float hazeFactor = clamp((dist - 16.0) / uHazeDistance, 0.0, 0.48);
      vec3 finalColor = mix(litColor, uHazeColor, hazeFactor);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDirection: { value: new THREE.Vector3(110, 135, 80).normalize() },
      uSunColor: { value: new THREE.Color(0xfffaed) },
      uSkyColor: { value: new THREE.Color(0xdbeafe) },
      uHazeDistance: { value: 65.0 },
      uHazeColor: { value: new THREE.Color(0xfef3c7) }
    },
    vertexShader: vert,
    fragmentShader: frag,
    depthWrite: false
  });
}

/**
 * Daylight Photorealistic Building Material:
 * Renders procedural architectural facades with multi-story window fenestration,
 * floor slabs, vertical piers, dark reflective glass, ground storefronts,
 * rooftop gravel/terracotta terraces, and atmospheric haze.
 * Inspired by Blackshark.ai / Maxar photorealistic aerial digital twins.
 */
export function createDaylightBuildingMaterial(options?: {
  differenceMode?: boolean;
}): THREE.ShaderMaterial {
  const daylightVert = /* glsl */ `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vColor;
    varying vec2 vUv;

    void main() {
      vColor = color;
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const daylightFrag = /* glsl */ `
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;
    uniform vec3 uGroundColor;
    uniform float uHazeDistance;
    uniform vec3 uHazeColor;
    uniform float uDifferenceMode;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vColor;
    varying vec2 vUv;

    // Pseudo-random noise hash
    float bldgHash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      vec3 sunDir = normalize(uSunDirection);

      bool isWall = abs(normal.y) < 0.45;
      bool isFlatRoof = normal.y > 0.75;

      vec3 albedo = vColor;
      float roughness = 0.65;
      float metalness = 0.15;
      float windowReflect = 0.0;

      if (isWall) {
        // Precise Procedural Architectural Facade:
        // Uses local polygon UV coordinates:
        // vUv.x is distance along wall segment; vUv.y is height from wall base.
        // 28.5 floors/world-unit (~3.2m/story) and 62.5 window bays/world-unit (~3.2m/bay).
        float floorCoord = vUv.y * 28.5;
        float floorIndex = floor(floorCoord);
        float floorFrac = fract(floorCoord);

        float bayCoord = vUv.x * 62.5;
        float bayIndex = floor(bayCoord);
        float bayFrac = fract(bayCoord);

        // Horizontal floor cornice slab band
        float corniceBand = step(0.84, floorFrac) + step(floorFrac, 0.16);
        
        // Vertical architectural column pier
        float pierBand = step(0.78, bayFrac) + step(bayFrac, 0.22);

        // Ground-level commercial storefront (retail street scale)
        bool isGroundFloor = vUv.y < 0.038;

        if (corniceBand > 0.5) {
          // Horizontal architectural slab cornice
          albedo = mix(vColor * 1.08, vColor * 0.92, floorFrac);
          roughness = 0.50;
        } else if (pierBand > 0.5) {
          // Vertical column pier
          albedo = vColor * 0.98;
          roughness = 0.60;
        } else if (isGroundFloor) {
          // Street-level storefront glazing & entrance display plinth
          albedo = mix(vec3(0.10, 0.14, 0.20), vColor * 0.88, step(0.5, bayFrac));
          roughness = 0.30;
          metalness = 0.40;
          windowReflect = 0.50;
        } else {
          // Recessed Architectural Window Opening
          float frameInset = step(0.18, floorFrac) * step(floorFrac, 0.82) *
                             step(0.24, bayFrac) * step(bayFrac, 0.76);

          if (frameInset > 0.5) {
            // Reflective dark blue-slate glass pane
            float hVal = bldgHash(vec2(floorIndex, bayIndex));
            vec3 glassBase = vec3(0.07, 0.11, 0.17);
            
            // Realistic office window variation: subtle blinds or soft warm interior glow
            if (hVal > 0.90) {
              glassBase = vec3(0.96, 0.84, 0.58); // Warm evening office light
            } else if (hVal > 0.75) {
              glassBase = vec3(0.15, 0.20, 0.28); // Shaded window blind
            }

            albedo = glassBase;
            roughness = 0.08;
            metalness = 0.80;
            windowReflect = 1.0;
          } else {
            // Window frame / sill trim
            albedo = vec3(0.24, 0.28, 0.34);
            roughness = 0.42;
          }
        }
      } else if (isFlatRoof) {
        // Flat roof terrace: weathered gravel tar / terracotta tile membrane
        float gravelNoise = bldgHash(floor(vWorldPosition.xz * 110.0)) * 0.08;
        albedo = clamp(vColor * (0.92 + gravelNoise), 0.0, 1.0);
        roughness = 0.75;
        metalness = 0.10;
      } else {
        // Pitched roof: terracotta clay tile with horizontal shingle lap lines
        float shingleFrac = fract(vWorldPosition.y * 110.0);
        float shingleShadow = mix(0.85, 1.05, smoothstep(0.0, 0.3, shingleFrac));
        albedo = clamp(vColor * shingleShadow, 0.0, 1.0);
        roughness = 0.60;
      }

      // Lighting Calculations:
      // 1. Direct Sun (warm golden daylight)
      float NdotL = max(0.0, dot(normal, sunDir));
      vec3 directSun = uSunColor * NdotL;

      // 2. Hemispherical Sky Fill (soft blue sky above, warm bounce below)
      float skyHemisphere = normal.y * 0.5 + 0.5;
      vec3 ambientFill = mix(uGroundColor, uSkyColor, skyHemisphere);

      // 3. Specular Sun Glint (especially on glass windows)
      vec3 halfVec = normalize(sunDir + viewDir);
      float NdotH = max(0.0, dot(normal, halfVec));
      float specPower = mix(16.0, 128.0, 1.0 - roughness);
      float specular = pow(NdotH, specPower) * (windowReflect * 0.85 + metalness * 0.25);
      vec3 specHighlight = uSunColor * specular;

      // 4. Subtle ambient contact occlusion at wall base
      float groundAO = isWall ? smoothstep(0.015, 0.05, vWorldPosition.y) * 0.35 + 0.65 : 1.0;

      // Total lit surface color
      vec3 finalColor = (albedo * (directSun + ambientFill) * groundAO) + specHighlight;

      // 5. Aerial Atmospheric Perspective Haze (fades into warm sunlit horizon haze)
      float dist = length(cameraPosition - vWorldPosition);
      float hazeFactor = clamp((dist - 14.0) / uHazeDistance, 0.0, 0.42);
      finalColor = mix(finalColor, uHazeColor, hazeFactor);

      if (uDifferenceMode > 0.5) {
        gl_FragColor = vec4(finalColor, 0.32);
      } else {
        gl_FragColor = vec4(finalColor, 1.0);
      }
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDirection: { value: new THREE.Vector3(110, 135, 80).normalize() },
      uSunColor: { value: new THREE.Color(0xfffaed) },
      uSkyColor: { value: new THREE.Color(0xdbeafe) },
      uGroundColor: { value: new THREE.Color(0xa8a29e) },
      uHazeDistance: { value: 65.0 },
      uHazeColor: { value: new THREE.Color(0xfef3c7) },
      uDifferenceMode: { value: options?.differenceMode ? 1.0 : 0.0 }
    },
    vertexShader: daylightVert,
    fragmentShader: daylightFrag,
    vertexColors: true,
    side: THREE.DoubleSide
  });
}

/**
 * Holographic Cyber Building Material:
 * Renders glowing translucent sapphire glass with bright cyan horizontal floor slices,
 * vertical cyber column mullions, luminous Fresnel edge bloom, and animated upward scan pulse.
 * Inspired by high-tech holographic digital twin command center visuals.
 */
export function createHolographicBuildingMaterial(options?: {
  differenceMode?: boolean;
}): THREE.ShaderMaterial {
  const holoVert = /* glsl */ `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const holoFrag = /* glsl */ `
    uniform float uTime;
    uniform vec3 uBaseColor;
    uniform vec3 uFresnelColor;
    uniform vec3 uGlassColor;
    uniform float uDifferenceMode;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);

      bool isWall = abs(normal.y) < 0.45;

      // Base translucent cyber sapphire crystalline glass matching Benchmark Image 2
      vec3 glass = uGlassColor;

      float dist = length(cameraPosition - vWorldPosition);

      // Distance LOD attenuation for high-frequency details to avoid cyan Moiré flood
      float floorLOD = smoothstep(28.0, 5.0, dist);
      float mullionLOD = smoothstep(16.0, 3.5, dist);

      vec3 floorGlow = vec3(0.0);
      vec3 vertGlow = vec3(0.0);
      vec3 plinthGlow = vec3(0.0);
      vec3 fresnelGlow = vec3(0.0);

      if (isWall) {
        // 1. Horizontal glowing cyan floor deck plates (every ~3.2m floor level)
        // Sharp, thin stacked cyber laser floors matching Benchmark Image 2
        float floorCoord = vUv.y * 28.5;
        float floorFrac = fract(floorCoord);
        float floorLine = smoothstep(0.030, 0.0, abs(floorFrac - 0.5) - 0.470);
        floorGlow = uBaseColor * floorLine * 2.2 * floorLOD;

        // 2. Vertical cyber column mullions on walls
        float bayCoord = vUv.x * 62.5;
        float bayFrac = fract(bayCoord);
        float vertLine = smoothstep(0.030, 0.0, abs(bayFrac - 0.5) - 0.470);
        vertGlow = vec3(0.0, 0.70, 0.95) * vertLine * 0.85 * mullionLOD;

        // 3. Ground contact base plinth glow (Benchmark 2 signature foundation ring)
        float basePlinth = smoothstep(0.040, 0.0, vUv.y) * 1.6;
        plinthGlow = uBaseColor * basePlinth * floorLOD;

        // 4. Fresnel silhouette rim bloom on wall edges
        float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 3.5);
        fresnelGlow = uFresnelColor * fresnel * 1.35;
      } else {
        // Roof surface: dark crystalline cyber glass with subtle grid texture
        vec2 roofGrid = abs(fract(vWorldPosition.xz * 35.0) - 0.5);
        float roofLine = smoothstep(0.035, 0.0, min(roofGrid.x, roofGrid.y));
        floorGlow = vec3(0.0, 0.35, 0.55) * roofLine * 0.35;
      }

      // 5. Upward animated cyber scan wave
      float scanWave = sin(vWorldPosition.y * 32.0 - uTime * 3.2);
      float scanPulse = smoothstep(0.90, 1.0, scanWave) * 0.35;
      vec3 scanGlow = vec3(0.15, 0.85, 1.0) * scanPulse * floorLOD;

      vec3 cyberColor = glass + floorGlow + vertGlow + plinthGlow + fresnelGlow + scanGlow;

      // 6. Deep Cyber Horizon Distance Fade into dark sapphire void:
      float horizonFade = smoothstep(9.0, 36.0, dist);
      vec3 voidColor = vec3(0.003, 0.009, 0.020);
      cyberColor = mix(cyberColor, voidColor, horizonFade * 0.88);

      float alpha = mix(0.85, 0.20, horizonFade);

      if (uDifferenceMode > 0.5) {
        gl_FragColor = vec4(cyberColor, 0.28);
      } else {
        gl_FragColor = vec4(cyberColor, alpha);
      }
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(0x00f0ff) },
      uFresnelColor: { value: new THREE.Color(0x38bdf8) },
      uGlassColor: { value: new THREE.Color(0x010b1a) },
      uDifferenceMode: { value: options?.differenceMode ? 1.0 : 0.0 }
    },
    vertexShader: holoVert,
    fragmentShader: holoFrag,
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide
  });
}

/**
 * Generates point geometry for glowing smart city IoT sensor beacons at road intersections.
 */
export function createCyberSensorNodesGeometry(
  features: OSMMapFeature[],
  bounds?: GeographicBounds
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const y = 0.045;

  let count = 0;
  for (const feature of features) {
    if (feature.kind !== 'road') continue;
    const coords = getFeatureCoordinates(feature);
    if (coords.length < 2) continue;

    // Pick start, mid, end coordinates as sensor node locations
    const candidateIndices = [0, Math.floor(coords.length / 2), coords.length - 1];
    for (const idx of candidateIndices) {
      const coord = coords[idx];
      if (bounds && !isCoordinateWithinBounds(coord, bounds)) continue;

      const p = geographicToWorld(coord[0], coord[1], y);
      positions.push(p.x, p.y, p.z);
      count++;
      if (count > 250) break; // Keep high-density but bounded for maximum 60 FPS
    }
    if (count > 250) break;
  }

  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}
