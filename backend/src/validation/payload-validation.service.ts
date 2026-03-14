import { Injectable } from '@nestjs/common';
import { ProviderResponseError } from '../common/errors/app-error';
import { LlmConfigService } from '../llm/llm-config.service';
import type { GeneratedExperiencePayload } from '../experience/dto/experience.dto';

@Injectable()
export class PayloadValidationService {
  constructor(private readonly config: LlmConfigService) {}

  parseAndValidate(rawOutput: string): GeneratedExperiencePayload {
    const jsonPayload = this.extractJsonObject(rawOutput);
    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonPayload);
    } catch {
      throw new ProviderResponseError('Model output was not valid JSON.');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new ProviderResponseError('Model output must be a JSON object.');
    }

    const candidate = parsed as Record<string, unknown>;
    const title = this.asNonEmptyString(candidate.title, 'title');
    const description = this.asNonEmptyString(candidate.description, 'description');
    const html = this.asNonEmptyString(candidate.html, 'html');
    const css = this.asNonEmptyString(candidate.css, 'css');
    const js = this.asNonEmptyString(candidate.js, 'js');

    this.ensureLengthWithinLimit(html, 'html');
    this.ensureLengthWithinLimit(css, 'css');
    this.ensureLengthWithinLimit(js, 'js');

    return {
      title,
      description,
      html,
      css,
      js,
    };
  }

  private asNonEmptyString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new ProviderResponseError(`${fieldName} must be a non-empty string.`);
    }

    return value.trim();
  }

  private ensureLengthWithinLimit(value: string, fieldName: string): void {
    if (value.length > this.config.maxPartChars) {
      throw new ProviderResponseError(
        `${fieldName} exceeds ${this.config.maxPartChars} characters.`,
      );
    }
  }

  private extractJsonObject(rawOutput: string): string {
    const trimmed = rawOutput.trim();
    if (trimmed.length === 0) {
      throw new ProviderResponseError('Model output was empty.');
    }

    if (trimmed.startsWith('```')) {
      const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
      if (fenced?.[1]) {
        return fenced[1].trim();
      }
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }

    throw new ProviderResponseError('Model output did not include a JSON object.');
  }
}
