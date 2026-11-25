import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertUsdMillionToINR,
  formatCostEstimate,
  formatINR,
  USD_TO_INR_REFERENCE_RATE
} from '../utils/currencyFormatter';

test('INR Currency Localization & Conversion Suite', async (t) => {
  await t.test('1. Reference exchange rate is positive and configured', () => {
    assert.equal(USD_TO_INR_REFERENCE_RATE, 84.0);
  });

  await t.test('2. Converts USD millions to crores accurately', () => {
    // 10.8 M USD * 84 = 907.2 M INR = 90.72 crore
    const res = convertUsdMillionToINR(10.8);
    assert.equal(res.inrTotal, 907_200_000);
    assert.equal(res.formatted, '₹90.7 crore');
    assert.ok(res.formattedFull.includes('₹90,72,00,000'));
    assert.equal(res.usdOriginalMillion, 10.8);
    assert.ok(res.disclosure.includes('benchmark conversion'));
  });

  await t.test('3. Converts small amounts to lakhs and thousands cleanly', () => {
    // 0.05 M USD * 84 = 4.2 M INR = 42 lakh
    const resLakh = convertUsdMillionToINR(0.05);
    assert.equal(resLakh.inrTotal, 4_200_000);
    assert.equal(resLakh.formatted, '₹42.0 lakh');

    // 0.0005 M USD * 84 = 42,000 INR
    const resSmall = convertUsdMillionToINR(0.0005);
    assert.equal(resSmall.inrTotal, 42_000);
    assert.equal(resSmall.formatted, '₹42,000');
  });

  await t.test('4. formatCostEstimate handles simple vs technical mode', () => {
    const simple = formatCostEstimate(4.2);
    assert.equal(simple, '₹35.3 crore');

    const withLabel = formatCostEstimate(4.2, { includeLabel: true });
    assert.equal(withLabel, 'Estimated cost: ₹35.3 crore (model estimate)');

    const tech = formatCostEstimate(4.2, { showTechnicalDetails: true });
    assert.ok(tech.includes('₹35.3 crore'));
    assert.ok(tech.includes('$4.2M USD reference'));

    const unestimated = formatCostEstimate(0);
    assert.equal(unestimated, 'Cost not estimated');
  });

  await t.test('5. formatINR formats Indian Rupees directly', () => {
    assert.equal(formatINR(50_000), '₹50,000');
    assert.equal(formatINR(250_000), '₹2.5 lakh');
    assert.equal(formatINR(12_000_000), '₹1.2 crore');
  });
});
