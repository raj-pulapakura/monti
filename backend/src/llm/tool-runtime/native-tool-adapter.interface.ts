import type { ProviderKind } from '../llm.types';
import type {
  CanonicalToolTurnRequest,
  CanonicalToolTurnResponse,
} from './tool-runtime.types';

export interface NativeToolAdapter {
  readonly provider: ProviderKind;
  executeTurn(request: CanonicalToolTurnRequest): Promise<CanonicalToolTurnResponse>;
}
