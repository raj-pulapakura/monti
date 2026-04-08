import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ValidationError } from '../../common/errors/app-error';
import { logEvent } from '../../common/logging/log-event';
import { LlmRouterService } from '../../llm/llm-router.service';
import { SUPABASE_CLIENT } from '../../supabase/supabase.constants';
import type { MontiSupabaseClient } from '../../supabase/supabase.types';

export interface RefinementSuggestion {
  label: string;
  prompt: string;
}

const SUGGESTION_SYSTEM_PROMPT = `You generate 2-4 short contextual refinement suggestions for an educator who is iterating on an interactive learning experience. Each suggestion should be a concrete follow-up action based on the current experience and the user's recent intent. Return a JSON object with a "suggestions" array.`;

const SUGGESTION_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['label', 'prompt'],
        properties: {
          label: { type: 'string' },
          prompt: { type: 'string' },
        },
      },
    },
  },
};

@Injectable()
export class RefinementSuggestionService {
  private readonly logger = new Logger(RefinementSuggestionService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly client: MontiSupabaseClient,
    private readonly llmRouter: LlmRouterService,
  ) {}

  async getSuggestions(input: {
    threadId: string;
    userId: string;
    experienceVersionId: string;
  }): Promise<RefinementSuggestion[]> {
    // Verify thread ownership
    const { data: thread } = await this.client
      .from('chat_threads')
      .select('id')
      .eq('id', input.threadId)
      .eq('user_id', input.userId)
      .maybeSingle();

    if (!thread) {
      throw new ValidationError('Thread not found for user scope.');
    }

    // Load experience version context
    const { data: version } = await this.client
      .from('experience_versions')
      .select('experience_id,description,html')
      .eq('id', input.experienceVersionId)
      .maybeSingle();

    if (!version) {
      return [];
    }

    const { data: experience } = await this.client
      .from('experiences')
      .select('title')
      .eq('id', version.experience_id)
      .maybeSingle();

    // Load recent user messages (last 5)
    const { data: messages } = await this.client
      .from('chat_messages')
      .select('content,role')
      .eq('thread_id', input.threadId)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(5);

    const recentUserMessages = (messages ?? [])
      .reverse()
      .map((m) => m.content)
      .join('\n');

    const visibleText = stripHtmlToText(version.html).slice(0, 500);

    const prompt = buildPrompt({
      title: experience?.title ?? 'Experience',
      description: version.description,
      recentUserMessages,
      visibleText,
    });

    try {
      const result = await this.llmRouter.generateStructured({
        prompt,
        system: SUGGESTION_SYSTEM_PROMPT,
        qualityMode: 'fast',
        maxTokens: 2000,
        temperature: 0.4,
        responseSchema: SUGGESTION_RESPONSE_SCHEMA,
      });

      return parseSuggestions(result.rawText);
    } catch (error) {
      this.logger.warn(
        logEvent('refinement_suggestions_generation_failed', {
          threadId: input.threadId,
          experienceVersionId: input.experienceVersionId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return [];
    }
  }
}

function buildPrompt(input: {
  title: string;
  description: string;
  recentUserMessages: string;
  visibleText: string;
}): string {
  const parts: string[] = [
    `Experience title: ${input.title}`,
    `Experience description: ${input.description}`,
  ];

  if (input.recentUserMessages.length > 0) {
    parts.push(`Recent user requests:\n${input.recentUserMessages}`);
  }

  if (input.visibleText.length > 0) {
    parts.push(`Visible content excerpt:\n${input.visibleText}`);
  }

  parts.push('Suggest 2-4 contextual follow-up refinements.');

  return parts.join('\n\n');
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSuggestions(rawText: string): RefinementSuggestion[] {
  try {
    const parsed = JSON.parse(rawText) as unknown;

    // Schema response: { suggestions: [...] }
    const items =
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray((parsed as Record<string, unknown>).suggestions)
        ? ((parsed as Record<string, unknown>).suggestions as unknown[])
        : Array.isArray(parsed)
          ? (parsed as unknown[])
          : null;

    if (!items) {
      return [];
    }

    const suggestions: RefinementSuggestion[] = [];
    for (const item of items) {
      if (
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).label === 'string' &&
        typeof (item as Record<string, unknown>).prompt === 'string'
      ) {
        const label = String((item as Record<string, unknown>).label).trim();
        const prompt = String((item as Record<string, unknown>).prompt).trim();
        if (label.length > 0 && prompt.length > 0) {
          suggestions.push({ label, prompt });
        }
      }
    }

    return suggestions.slice(0, 4);
  } catch {
    return [];
  }
}
