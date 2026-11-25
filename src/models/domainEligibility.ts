import { Scenario } from '../types';

export interface GeographicFeatureLike {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  lat: number;
  lon: number;
}

export interface DomainEligibilityResult {
  isEligible: boolean;
  reason?: string;
  unsupportedMessage: string;
  coverageDomainLabel: string;
}

export interface DomainCoverageExplanation {
  domain: string;
  supportedLabel: string;
  greenExplanation: string;
  greyExplanation: string;
  recommendedSelectionPrompt: string;
}

export function getDomainCoverageExplanation(domain: string): DomainCoverageExplanation {
  if (domain === 'traffic') {
    return {
      domain: 'traffic',
      supportedLabel: 'Road Traffic Network',
      greenExplanation:
        'Green roads show where traffic simulation is available. Select a highlighted road corridor or intersection.',
      greyExplanation:
        'Grey areas can still be explored, but simulation is not currently available there.',
      recommendedSelectionPrompt:
        'Select a highlighted green road or intersection to simulate traffic flow.'
    };
  }
  if (domain === 'water') {
    return {
      domain: 'water',
      supportedLabel: 'Municipal Water Distribution Network',
      greenExplanation:
        'Green areas show where the modeled water network is available. Select a highlighted pipe or junction.',
      greyExplanation:
        'Grey areas can still be explored, but simulation is not currently available there.',
      recommendedSelectionPrompt:
        'Select a highlighted green pipe or water junction to simulate pressure and flow.'
    };
  }
  return {
    domain: 'energy',
    supportedLabel: 'High-Voltage Power Transmission Grid',
    greenExplanation:
      'Green areas show where the modeled electricity network is available. Select a highlighted power line or substation.',
    greyExplanation:
      'Grey areas can still be explored, but simulation is not currently available there.',
    recommendedSelectionPrompt:
      'Select a highlighted green power line or substation to simulate electricity transmission.'
  };
}

/**
 * Validates whether a geographic feature or location is covered by the active simulation model.
 * Map exploration remains completely unrestricted, but simulation execution is restricted
 * to locations with active network model topology.
 */
export function checkDomainEligibility(
  scenario: Scenario,
  feature: GeographicFeatureLike | null
): DomainEligibilityResult {
  if (!feature) {
    return {
      isEligible: true,
      unsupportedMessage: '',
      coverageDomainLabel: scenario.domain
    };
  }

  const domain = scenario.domain;
  const category = (feature.category || '').toLowerCase();
  const title = (feature.title || '').toLowerCase();
  const id = (feature.id || '').toLowerCase();

  const standardUnsupportedMsg =
    'Simulation is not available here yet. Your selected area is not currently covered by the active simulation model. You can still explore this location on the map.';

  if (domain === 'traffic') {
    // Only supported road corridors, highways, intersections, and transit links
    const isRoadOrJct =
      category === 'road' ||
      category === 'highway' ||
      category === 'intersection' ||
      title.includes('road') ||
      title.includes('highway') ||
      title.includes('expressway') ||
      title.includes('junction') ||
      title.includes('bypass') ||
      title.includes('corridor') ||
      title.includes('nh16') ||
      title.includes('street') ||
      title.includes('lane') ||
      title.includes('intersection');

    // Also match any modeled traffic cells
    const matchesModel =
      scenario.trafficNetwork?.cells?.some((c) => id.includes(c.id.toLowerCase()));

    if (isRoadOrJct || matchesModel) {
      return {
        isEligible: true,
        unsupportedMessage: '',
        coverageDomainLabel: 'Road Traffic Network'
      };
    }

    return {
      isEligible: false,
      reason: 'Building or land parcel without mapped road corridor coverage.',
      unsupportedMessage:
        'Simulation is not available here yet. Your selected area is not currently covered by the active traffic simulation model. You can still explore this location on the map.',
      coverageDomainLabel: 'Road Traffic Network'
    };
  }

  if (domain === 'water') {
    // Only supported water distribution network coverage (pipes, junctions, reservoirs, treatment plants, pumps)
    const isWaterInfrastructure =
      category === 'water' ||
      category === 'pipe' ||
      category === 'pump' ||
      category === 'reservoir' ||
      category === 'tank' ||
      title.includes('water') ||
      title.includes('reservoir') ||
      title.includes('canal') ||
      title.includes('tank') ||
      title.includes('pump') ||
      title.includes('pipe') ||
      title.includes('treatment') ||
      title.includes('wtp') ||
      title.includes('distribution') ||
      title.includes('supply');

    const matchesNetwork =
      scenario.waterNetwork?.nodes?.some(
        (n) => id.includes(n.id.toLowerCase()) || title.includes(n.name?.toLowerCase() || '')
      ) ||
      scenario.waterNetwork?.pipes?.some((p) => id.includes(p.id.toLowerCase()));

    if (isWaterInfrastructure || matchesNetwork) {
      return {
        isEligible: true,
        unsupportedMessage: '',
        coverageDomainLabel: 'Municipal Water Distribution Network'
      };
    }

    return {
      isEligible: false,
      reason: 'Location does not contain modeled water network pipes or delivery junctions.',
      unsupportedMessage: standardUnsupportedMsg,
      coverageDomainLabel: 'Municipal Water Distribution Network'
    };
  }

  if (domain === 'energy') {
    // Only supported power network coverage (substations, transmission lines, buses, solar plants, transformers)
    const isPowerInfrastructure =
      category === 'energy' ||
      category === 'power' ||
      category === 'substation' ||
      category === 'transmission' ||
      title.includes('substation') ||
      title.includes('power') ||
      title.includes('electric') ||
      title.includes('solar') ||
      title.includes('transmission') ||
      title.includes('grid') ||
      title.includes('transformer') ||
      title.includes('feeder');

    const matchesGrid =
      scenario.powerNetwork?.buses?.some(
        (b) => id.includes(b.id.toLowerCase()) || title.includes(b.name?.toLowerCase() || '')
      ) ||
      scenario.powerNetwork?.lines?.some((br) => id.includes(br.id.toLowerCase()));

    if (isPowerInfrastructure || matchesGrid) {
      return {
        isEligible: true,
        unsupportedMessage: '',
        coverageDomainLabel: 'High-Voltage Power Transmission Grid'
      };
    }

    return {
      isEligible: false,
      reason: 'Location is not within high-voltage transmission substation or line coverage.',
      unsupportedMessage: standardUnsupportedMsg,
      coverageDomainLabel: 'High-Voltage Power Transmission Grid'
    };
  }

  return {
    isEligible: true,
    unsupportedMessage: '',
    coverageDomainLabel: scenario.domain
  };
}
