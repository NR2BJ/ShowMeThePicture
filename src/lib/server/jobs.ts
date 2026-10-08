// pg-boss 큐 이름. app 이 send, worker 가 work.
export const Q = {
	SCAN_SOURCE: 'scan-source',
	EXTRACT_METADATA: 'extract-metadata',
	DERIVE: 'derive',
	HASH: 'hash',
	EMBED: 'embed',
	PAIR: 'pair'
} as const;

export type ScanSourceJob = { sourceId: string; full?: boolean };
