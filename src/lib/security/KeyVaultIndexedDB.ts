export enum StorageMode {
    PERSISTENT = 'PERSISTENT',
    EPHEMERAL = 'EPHEMERAL',
    SESSION_ONLY = 'SESSION_ONLY',
    UNAVAILABLE = 'UNAVAILABLE'
}

export interface KeyInfo {
    version: number;
    createdAt: string;
    lastAccessedAt: string;
    mode: StorageMode;
}

export async function getKeyInfo(clinicId: string): Promise<KeyInfo> {
    return {
        version: 1,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        mode: StorageMode.PERSISTENT
    };
}

export async function requestPersistentStorage(): Promise<StorageMode> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        return isPersisted ? StorageMode.PERSISTENT : StorageMode.EPHEMERAL;
    }
    return StorageMode.EPHEMERAL;
}

export async function getShares(clinicId: string): Promise<string[]> {
    return [];
}
