export interface OnshapeClient {
  get(path: string, params?: Record<string, unknown>): Promise<any>;
  post(path: string, body?: unknown): Promise<any>;
  del(path: string, params?: Record<string, unknown>): Promise<any>;
  callsUsed(): number;
  whoAmI(): Promise<{ id?: string; name?: string }>;
  listMyDocuments(maxDocuments?: number): Promise<{ docs: any[]; pages: number }>;
  getDefaultWorkspaceId(doc: any): Promise<string>;
  fetchDocumentHistory(
    documentId: string,
    workspaceId: string,
    opts?: { cutoffDate?: Date }
  ): Promise<{ rows: any[]; pages: number; possiblyTruncatedAt50: boolean }>;
  registerWebhook(opts: {
    documentId: string;
    events: string[];
    url: string;
    collapseEvents?: boolean;
  }): Promise<{ id: string; [key: string]: unknown }>;
  listWebhooks(userId: string): Promise<any[]>;
  unregisterWebhook(webhookId: string): Promise<unknown>;
}

export declare function makeClient(opts: {
  accessKey: string;
  secretKey: string;
  maxCalls: number;
}): OnshapeClient;
