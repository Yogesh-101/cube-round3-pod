import {
  AIInspectionResult,
  BusinessRule,
  DispositionRecommendation,
  DecisionReason,
  DispositionType,
} from '../types';

/**
 * Deterministic Decision Engine
 * Separates AI computer vision observations from business rules.
 * Evaluates observations against prioritized, configurable business rules.
 */
export function evaluateDispositionRules(
  aiResult: AIInspectionResult,
  rules: BusinessRule[]
): DispositionRecommendation {
  const activeRules = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority - a.priority);

  const { identity, completeness, condition, integrity } = aiResult;

  for (const rule of activeRules) {
    const { conditionCriteria } = rule;
    let matches = true;

    // Check Integrity Status
    if (conditionCriteria.integrityStatus && conditionCriteria.integrityStatus.length > 0) {
      if (!conditionCriteria.integrityStatus.includes(integrity.status)) {
        matches = false;
      }
    }

    // Check Identity Match
    if (conditionCriteria.identityMatch !== undefined) {
      const isMatch = identity.status === 'MATCH';
      if (isMatch !== conditionCriteria.identityMatch) {
        matches = false;
      }
    }

    // Check Completeness Status
    if (conditionCriteria.completenessStatus && conditionCriteria.completenessStatus.length > 0) {
      if (!conditionCriteria.completenessStatus.includes(completeness.status)) {
        matches = false;
      }
    }

    // Check Wear Level
    if (conditionCriteria.maxWearLevel) {
      const wearRanks: Record<string, number> = {
        PRISTINE: 1,
        MINOR: 2,
        MODERATE: 3,
        SEVERE: 4,
      };
      const currentRank = wearRanks[condition.wearLevel] || 2;
      const allowedRank = wearRanks[conditionCriteria.maxWearLevel] || 2;
      if (currentRank > allowedRank) {
        matches = false;
      }
    }

    if (matches) {
      const reasons = generateEvidenceBasedReasons(aiResult, rule.recommendedDisposition);
      return {
        disposition: rule.recommendedDisposition,
        appliedRuleId: rule.id,
        ruleName: rule.name,
        reasons,
      };
    }
  }

  // Fallback if no specific rule matched
  const fallbackDisposition: DispositionType =
    integrity.status === 'POTENTIAL_PRODUCT_SWAP'
      ? 'LIQUIDATE'
      : completeness.status === 'COMPLETE' && condition.wearLevel === 'PRISTINE'
      ? 'RESTOCK'
      : completeness.status === 'PARTIAL' && condition.wearLevel === 'MINOR'
      ? 'REFURBISH'
      : 'LIQUIDATE';

  return {
    disposition: fallbackDisposition,
    appliedRuleId: 'RULE-DEFAULT-FALLBACK',
    ruleName: 'Default Standard Disposition Policy',
    reasons: generateEvidenceBasedReasons(aiResult, fallbackDisposition),
  };
}

function generateEvidenceBasedReasons(
  aiResult: AIInspectionResult,
  disposition: DispositionType | 'MANUAL_REVIEW'
): DecisionReason[] {
  const reasons: DecisionReason[] = [];
  const { identity, completeness, condition, integrity } = aiResult;

  // Identity / Box Swap verification points
  if (identity.status === 'MATCH') {
    reasons.push({
      point: `Physical product verified: authentic ${identity.expectedProduct} casing & signatures confirmed.`,
      type: 'PASS',
    });
  } else if (identity.status === 'POTENTIAL_MISMATCH') {
    reasons.push({
      point: `Potential Product Mismatch — Manual Review Required. Expected order product is ${identity.expectedProduct}, but physical device hardware matches ${identity.detectedProduct}.`,
      type: 'FAIL',
    });
  } else {
    reasons.push({
      point: 'Product identity unverified from available imagery — Manual Review Required.',
      type: 'WARN',
    });
  }

  // Box vs Physical Device Consistency
  if (identity.boxVsDeviceComparison) {
    if (identity.boxVsDeviceComparison.isProductMismatch) {
      reasons.push({
        point: 'Box & expected product match, but returned physical device is a different model. Case flagged for supervisor forensic review.',
        type: 'FAIL',
      });
    }

    if (identity.boxVsDeviceComparison.serialNumberConsistency === 'VERIFIED_MATCH') {
      reasons.push({
        point: 'Device body laser serial matches outer packaging barcode SKU & serial.',
        type: 'PASS',
      });
    } else if (identity.boxVsDeviceComparison.serialNumberConsistency === 'MISMATCH_DETECTED') {
      reasons.push({
        point: 'Device laser serial conflict: physical device number does not match box barcode.',
        type: 'FAIL',
      });
    }
  }

  // Completeness verification points
  if (completeness.missingCount === 0) {
    reasons.push({
      point: `All ${completeness.expectedCount} factory components and accessories verified present.`,
      type: 'PASS',
    });
  } else {
    reasons.push({
      point: `${completeness.missingCount} of ${completeness.expectedCount} components missing: ${completeness.missingComponents.join(', ')}.`,
      type: disposition === 'REFURBISH' ? 'WARN' : 'FAIL',
    });
  }

  // Condition assessment points
  if (condition.wearLevel === 'PRISTINE') {
    reasons.push({
      point: 'Cosmetic condition assessed as pristine with zero visible abrasions or fracture marks.',
      type: 'PASS',
    });
  } else if (condition.wearLevel === 'MINOR') {
    reasons.push({
      point: `Minor cosmetic wear detected (${condition.defects.map((d) => d.type).join(', ') || 'surface handling marks'}). Eligible for repackaging.`,
      type: 'WARN',
    });
  } else if (condition.wearLevel === 'MODERATE') {
    reasons.push({
      point: 'Moderate cosmetic wear or handling marks exceed primary shelf-restock threshold.',
      type: 'WARN',
    });
  } else if (condition.wearLevel === 'SEVERE') {
    reasons.push({
      point: 'Severe structural/electrical safety compromise detected. Item cannot be safely recirculated.',
      type: 'FAIL',
    });
  }

  // Disposition-specific guidance
  if (disposition === 'RESTOCK') {
    reasons.push({
      point: 'Direct return to warehouse active inventory authorized for immediate resale.',
      type: 'INFO',
    });
  } else if (disposition === 'REFURBISH') {
    reasons.push({
      point: 'Assigned to Refurbishment & Re-kitting station for accessory replacement or re-boxing.',
      type: 'INFO',
    });
  } else if (disposition === 'LIQUIDATE') {
    reasons.push({
      point: 'Routed to secondary liquidation channel / certified B-stock auction.',
      type: 'INFO',
    });
  } else if (disposition === 'DISPOSE') {
    reasons.push({
      point: 'Hazardous or unrecoverable inventory flagged for certified electronic recycling.',
      type: 'INFO',
    });
  } else if (disposition === 'MANUAL_REVIEW') {
    reasons.push({
      point: 'High-risk or conflicting return integrity evidence routed to supervisor manual audit queue.',
      type: 'WARN',
    });
  }

  return reasons;
}
