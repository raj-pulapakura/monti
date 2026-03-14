import { Injectable } from '@nestjs/common';
import { SafetyViolationError } from '../common/errors/app-error';
import type { GeneratedExperiencePayload } from '../experience/dto/experience.dto';

interface Rule {
  name: string;
  pattern: RegExp;
}

const DISALLOWED_RULES: Rule[] = [
  {
    name: 'external_script_source',
    pattern: /<script[^>]*\bsrc\s*=/i,
  },
  {
    name: 'network_api_calls',
    pattern: /\b(fetch|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon)\s*\(/i,
  },
  {
    name: 'navigation_mutation',
    pattern: /\b(window\.)?location\.(href|assign|replace)\s*=|\blocation\s*=\s*/i,
  },
  {
    name: 'document_cookie_access',
    pattern: /\bdocument\.cookie\b/i,
  },
  {
    name: 'external_url_reference',
    pattern: /https?:\/\//i,
  },
];

@Injectable()
export class SafetyGuardService {
  assertSafe(payload: GeneratedExperiencePayload): void {
    const sources: Array<[string, string]> = [
      ['html', payload.html],
      ['css', payload.css],
      ['js', payload.js],
    ];

    for (const [partName, value] of sources) {
      for (const rule of DISALLOWED_RULES) {
        if (rule.pattern.test(value)) {
          throw new SafetyViolationError(
            `Generated payload violated safety rule: ${rule.name}.`,
            { rule: rule.name, part: partName },
          );
        }
      }
    }
  }
}
