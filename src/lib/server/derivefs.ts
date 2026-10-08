import { rm } from 'node:fs/promises';
import { derivativeDir } from './media';

export async function removeDerivatives(cacheDir: string, fileId: string): Promise<void> {
	await rm(derivativeDir(cacheDir, fileId), { recursive: true, force: true });
}
