export type WriteResult = { meta: { changes: number } };
export type Statement = {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<WriteResult>;
};
export type ManagementDB = {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<WriteResult[]>;
};
