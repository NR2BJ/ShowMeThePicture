// pg-boss 큐 이름. app 이 send, worker 가 work.
export const Q = {
	SCAN_SOURCE: 'scan-source',
	PROCESS_FILE: 'process-file',
	RELINK_SOURCE: 'relink-source',
	EMBED: 'embed',
	PAIR: 'pair'
} as const;

export type ScanSourceJob = { sourceId: string; full?: boolean };
export type ProcessFileJob = { fileId: string };
export type PairJob = { fileId?: string; all?: boolean };
export type RelinkJob = { sourceId: string };
