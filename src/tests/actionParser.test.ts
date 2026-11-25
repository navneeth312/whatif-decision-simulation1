import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeActionText,
  detectDomainRelevance,
  parseAndValidateActionProposal,
  DOMAIN_EXAMPLE_PROMPTS
} from '../models/actionParser';
import { DEFAULT_SCENARIOS } from '../models/defaultScenarios';

test('Action-First Structured Parser & Engineering Safety Suite', async (t) => {
  const trafficScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic')!;
  const waterScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'water')!;
  const energyScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'energy')!;

  assert.ok(trafficScenario, 'Traffic scenario exists');
  assert.ok(waterScenario, 'Water scenario exists');
  assert.ok(energyScenario, 'Energy scenario exists');

  await t.test('1. Security & Sanitization: strips HTML, script tags, control chars, and prototype pollution', () => {
    const malicious = '<script>alert("hack")</script>__proto__ constructor Build new bypass road \x00\x1F';
    const cleaned = sanitizeActionText(malicious);
    assert.strictEqual(cleaned.includes('<script>'), false);
    assert.strictEqual(cleaned.includes('__proto__'), false);
    assert.strictEqual(cleaned.includes('constructor'), false);
    assert.strictEqual(cleaned.includes('Build new bypass road'), true);

    // Tests length ceiling of 500 characters
    const superLong = 'a'.repeat(600);
    assert.strictEqual(sanitizeActionText(superLong).length, 500);
  });

  await t.test('2. Unrelated or Invalid: rejects empty, trivial, and off-topic submissions safely', () => {
    // Empty / trivial
    const emptyRes = parseAndValidateActionProposal({
      rawText: '   ',
      domain: 'traffic',
      verb: 'upgrade',
      scale: 2,
      timingMonths: 12,
      capexMillion: 8.5,
      scenario: trafficScenario
    });
    assert.strictEqual(emptyRes.status, 'unrelated-or-invalid');
    assert.strictEqual(emptyRes.synthesizedAlternative, undefined);
    assert.ok(emptyRes.examplePrompts && emptyRes.examplePrompts.length > 0);

    // Off-topic crypto / pizza
    const cryptoRes = parseAndValidateActionProposal({
      rawText: 'Buy bitcoin and sell crypto tokens for profit',
      domain: 'traffic',
      verb: 'upgrade',
      scale: 2,
      timingMonths: 12,
      capexMillion: 8.5,
      scenario: trafficScenario
    });
    assert.strictEqual(cryptoRes.status, 'unrelated-or-invalid');
    assert.strictEqual(cryptoRes.domainMismatch, false);
    assert.ok(cryptoRes.rejectionReason?.includes('outside physical civil infrastructure'));
  });

  await t.test('3. Domain Mismatch: blocks cross-domain inputs and guides the user', () => {
    // Water pipe proposal entered in a traffic scenario
    const mismatchRes = parseAndValidateActionProposal({
      rawText: 'Install a high pressure booster pump and upgrade water pipeline diameter',
      domain: 'traffic',
      verb: 'upgrade',
      scale: 2,
      timingMonths: 12,
      capexMillion: 8.5,
      scenario: trafficScenario
    });
    assert.strictEqual(mismatchRes.status, 'unrelated-or-invalid');
    assert.strictEqual(mismatchRes.domainMismatch, true);
    assert.strictEqual(mismatchRes.detectedDomain, 'water');
    assert.ok(mismatchRes.rejectionReason?.includes('describes WATER infrastructure, but the active workspace is configured for the TRAFFIC domain'));
  });

  await t.test('4. Relevant but Unsupported: recognizes physical unmodeled phenomena honestly', () => {
    // Traffic pavement cracks / potholes
    const trafficPavementRes = parseAndValidateActionProposal({
      rawText: 'Resurface asphalt to fix pavement cracking and eliminate deep potholes',
      domain: 'traffic',
      verb: 'upgrade',
      scale: 2,
      timingMonths: 12,
      capexMillion: 8.5,
      scenario: trafficScenario
    });
    assert.strictEqual(trafficPavementRes.status, 'relevant-unsupported');
    assert.strictEqual(trafficPavementRes.unmodeledPhenomenon, 'Pavement Structural Deterioration & Geotechnical Settling');
    assert.ok(trafficPavementRes.whyUnmodeled?.includes('macroscopic solver models vehicle conservation'));
    assert.ok(trafficPavementRes.requiredDataOrModel?.includes('Pavement Distress Index'));
    assert.ok(trafficPavementRes.recommendedSupportedAlternative);
    assert.ok(trafficPavementRes.suggestedActionPrompt);

    // Water acoustic water hammer
    const waterHammerRes = parseAndValidateActionProposal({
      rawText: 'Prevent acoustic transient water hammer and pipe burst surge waves',
      domain: 'water',
      verb: 'restrict',
      scale: 2,
      timingMonths: 12,
      capexMillion: 8.5,
      scenario: waterScenario
    });
    assert.strictEqual(waterHammerRes.status, 'relevant-unsupported');
    assert.strictEqual(waterHammerRes.unmodeledPhenomenon, 'Joukowsky Acoustic Water Hammer & Fluid Transients');

    // Energy reactive power MVAR
    const energyVarRes = parseAndValidateActionProposal({
      rawText: 'Inject reactive power MVAR and install shunt capacitor banks for voltage collapse',
      domain: 'energy',
      verb: 'upgrade',
      scale: 2,
      timingMonths: 12,
      capexMillion: 8.5,
      scenario: energyScenario
    });
    assert.strictEqual(energyVarRes.status, 'relevant-unsupported');
    assert.strictEqual(energyVarRes.unmodeledPhenomenon, 'AC Reactive Power (MVAR) & Non-linear Voltage Stability');
  });

  await t.test('5. Ambiguous or Incomplete: identifies vague goals and provides clarification chips', () => {
    const vagueRes = parseAndValidateActionProposal({
      rawText: 'make it faster and reduce delays',
      domain: 'traffic',
      verb: 'upgrade',
      scale: 2,
      timingMonths: 12,
      capexMillion: 8.5,
      scenario: trafficScenario
    });
    assert.strictEqual(vagueRes.status, 'ambiguous-incomplete');
    assert.ok(vagueRes.clarificationQuestion);
    assert.ok(vagueRes.clarificationOptions && vagueRes.clarificationOptions.length >= 2);
    assert.ok(vagueRes.clarificationOptions[0].actionText);
    assert.ok(vagueRes.clarificationOptions[0].label);
  });

  await t.test('6. Supported & Complete: synthesizes valid modifications with governing equations', () => {
    // Traffic BRT proposal
    const trafficComplete = parseAndValidateActionProposal({
      rawText: 'Add a dedicated BRT priority lane and synchronize traffic signals',
      domain: 'traffic',
      verb: 'upgrade',
      scale: 2,
      timingMonths: 12,
      capexMillion: 8.5,
      scenario: trafficScenario
    });
    assert.strictEqual(trafficComplete.status, 'supported-complete');
    assert.ok(trafficComplete.targetAssetId);
    assert.ok(trafficComplete.targetAssetName);
    assert.ok(trafficComplete.modifications && trafficComplete.modifications.length > 0);
    assert.ok(trafficComplete.governingEquation);
    assert.ok(trafficComplete.governingEquation.formula);
    assert.strictEqual(trafficComplete.synthesizedAlternative?.capexCostMillion, 8.5);
    assert.strictEqual(trafficComplete.synthesizedAlternative?.implementationMonths, 12);
    assert.strictEqual(trafficComplete.synthesizedAlternative?.costDataStatus, 'illustrative');

    // Water diameter upgrade
    const waterComplete = parseAndValidateActionProposal({
      rawText: 'Widen trunk pipeline conduit diameter to reduce hydraulic head loss',
      domain: 'water',
      verb: 'upgrade',
      scale: 3,
      timingMonths: 18,
      capexMillion: 12.0,
      scenario: waterScenario
    });
    assert.strictEqual(waterComplete.status, 'supported-complete');
    assert.ok(waterComplete.modifications?.some((m) => m.property === 'diameter'));

    // Energy line reconductoring
    const energyComplete = parseAndValidateActionProposal({
      rawText: 'Reconductor transmission branch line to increase thermal rating and reduce reactance',
      domain: 'energy',
      verb: 'upgrade',
      scale: 2,
      timingMonths: 24,
      capexMillion: 15.0,
      scenario: energyScenario
    });
    assert.strictEqual(energyComplete.status, 'supported-complete');
    assert.ok(energyComplete.modifications?.some((m) => m.property === 'thermalRatingMw'));
  });

  await t.test('7. Multi-Part / Combined Actions: decomposes physical modeled vs unmodeled policy components', () => {
    // Multi-part action: BRT lane + congestion pricing toll
    const multiPartTraffic = parseAndValidateActionProposal({
      rawText: 'Add dedicated BRT priority lane and implement dynamic congestion pricing toll',
      domain: 'traffic',
      verb: 'upgrade',
      scale: 2,
      timingMonths: 12,
      capexMillion: 8.5,
      scenario: trafficScenario
    });

    assert.strictEqual(multiPartTraffic.status, 'supported-complete');
    assert.strictEqual(multiPartTraffic.isMultiPartAction, true);
    assert.ok(multiPartTraffic.confidenceLabel?.includes('Semantic Match: Supported Action Template'));
    assert.ok(multiPartTraffic.modeledComponents && multiPartTraffic.modeledComponents.length >= 1);
    assert.ok(multiPartTraffic.unmodeledComponents && multiPartTraffic.unmodeledComponents.length >= 1);
    assert.strictEqual(
      multiPartTraffic.unmodeledComponents[0].component,
      'Congestion Pricing / Road User Tolling Policy'
    );
    assert.ok(multiPartTraffic.unmodeledComponents[0].requiredDataOrModel.includes('willingness-to-pay'));
    assert.ok(multiPartTraffic.warnings.some((w) => w.includes('Multi-part action proposal detected')));
  });
});
