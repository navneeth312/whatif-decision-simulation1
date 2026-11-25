const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const REGION_GZ_PATH = path.join(__dirname, '..', 'public', 'maps', 'region.json.gz');
const REGION_JSON_PATH = path.join(__dirname, '..', 'public', 'maps', 'region.json');
const OUTPUT_JSON_PATH = path.join(__dirname, '..', 'docs', 'regional_dataset_audit.json');

const useGz = fs.existsSync(REGION_GZ_PATH);
const activePath = useGz ? REGION_GZ_PATH : REGION_JSON_PATH;
console.log('Loading region dataset from:', activePath);
const rawData = useGz
  ? zlib.gunzipSync(fs.readFileSync(REGION_GZ_PATH)).toString('utf8')
  : fs.readFileSync(REGION_JSON_PATH, 'utf8');
const data = JSON.parse(rawData);

const features = data.features || [];
const totalFeatures = features.length;

let buildingFootprints = 0;
let explicitHeightCount = 0;
let buildingLevelsCount = 0;
let buildingPartCount = 0;
let roofTagCount = 0;
let genericBuildingYesCount = 0;
let specificBuildingCount = 0;

const buildingTypes = {};
const levelDistribution = {};
const explicitHeightsList = [];
const sampleLevelsList = [];

for (const feat of features) {
  const kind = feat.kind || '';
  const props = feat.properties || {};
  const tags = feat.tags || {};

  // Check building footprint
  const bldgVal = feat.building || props.building || tags.building;
  const isBuilding = kind === 'building' || Boolean(bldgVal);

  if (isBuilding) {
    buildingFootprints++;
    const bStr = String(bldgVal || '').toLowerCase().trim();
    if (bStr === 'yes' || bStr === 'true' || bStr === '1' || bStr === '') {
      genericBuildingYesCount++;
    } else {
      specificBuildingCount++;
      buildingTypes[bStr] = (buildingTypes[bStr] || 0) + 1;
    }
  }

  // Check explicit height
  const hVal = feat.height !== undefined ? feat.height : (props.height !== undefined ? props.height : tags.height);
  if (hVal !== undefined && String(hVal).trim() !== '') {
    explicitHeightCount++;
    explicitHeightsList.push({
      id: feat.id,
      height: hVal,
      name: feat.name || props.name || tags.name || null,
      building: bldgVal || null
    });
  }

  // Check building:levels or levels
  const lvlVal = feat['building:levels'] || props['building:levels'] || tags['building:levels'] ||
                 feat.levels || props.levels || tags.levels;
  if (lvlVal !== undefined && String(lvlVal).trim() !== '') {
    buildingLevelsCount++;
    const key = String(lvlVal).trim();
    levelDistribution[key] = (levelDistribution[key] || 0) + 1;
    if (sampleLevelsList.length < 15) {
      sampleLevelsList.push({
        id: feat.id,
        levels: lvlVal,
        name: feat.name || props.name || tags.name || null,
        building: bldgVal || null
      });
    }
  }

  // Check building:part
  const bPart = feat['building:part'] || props['building:part'] || tags['building:part'];
  if (bPart !== undefined && String(bPart).trim() !== '') {
    buildingPartCount++;
  }

  // Check roof:*
  let hasRoof = false;
  for (const obj of [feat, props, tags]) {
    if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        if (k.startsWith('roof:') || k === 'roof') {
          hasRoof = true;
          break;
        }
      }
    }
    if (hasRoof) break;
  }
  if (hasRoof) {
    roofTagCount++;
  }
}

const auditResult = {
  auditTimestamp: new Date().toISOString(),
  datasetFile: useGz ? 'public/maps/region.json.gz' : 'public/maps/region.json',
  summary: {
    totalFeatures,
    buildingFootprints,
    buildingLevelsFeatures: buildingLevelsCount,
    explicitHeightFeatures: explicitHeightCount,
    buildingPartFeatures: buildingPartCount,
    roofTagFeatures: roofTagCount,
    genericBuildingYes: genericBuildingYesCount,
    specificBuildingTypes: specificBuildingCount
  },
  levelDistribution,
  topSpecificBuildingClassifications: Object.entries(buildingTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([type, count]) => ({ type, count })),
  all19ExplicitHeights: explicitHeightsList,
  sampleBuildingLevels: sampleLevelsList
};

const docsDir = path.dirname(OUTPUT_JSON_PATH);
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(auditResult, null, 2), 'utf8');

console.log('--- REPRODUCIBLE DATASET AUDIT RESULTS ---');
console.log('Total Features:', totalFeatures);
console.log('Building Footprints:', buildingFootprints);
console.log('Features with building:levels:', buildingLevelsCount);
console.log('Features with explicit height:', explicitHeightCount);
console.log('Features with building:part:', buildingPartCount);
console.log('Features with roof:* tags:', roofTagCount);
console.log('Generic building=yes:', genericBuildingYesCount);
console.log('Specific building classifications:', specificBuildingCount);
console.log('Top classifications:', auditResult.topSpecificBuildingClassifications.slice(0, 8));
console.log('Audit saved to:', OUTPUT_JSON_PATH);
