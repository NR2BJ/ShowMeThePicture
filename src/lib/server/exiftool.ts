// app 프로세스용 ExifTool 싱글턴 (RAW 의 full 파생본을 즉석 생성할 때만 쓴다).
import { ExifTool } from 'exiftool-vendored';

let instance: ExifTool | null = null;

export function getExifTool(): ExifTool {
	if (!instance) {
		instance = new ExifTool({ maxProcs: 1 });
		const end = () => instance?.end().catch(() => {});
		process.once('SIGTERM', end);
		process.once('SIGINT', end);
	}
	return instance;
}
