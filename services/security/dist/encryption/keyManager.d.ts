export interface EncryptionKey {
    id: string;
    algorithm: string;
    keyData: Buffer;
    createdAt: Date;
    rotatedAt?: Date;
    status: 'active' | 'rotating' | 'deprecated';
}
export interface EncryptionResult {
    encryptedData: Buffer;
    keyId: string;
    iv: Buffer;
    authTag: Buffer;
}
export declare class KeyManager {
    private keys;
    private currentKeyId;
    private keyRotationInterval;
    private keyDerivationSalt;
    constructor();
    private initializeDefaultKey;
    generateNewKey(): Promise<string>;
    rotateKey(): Promise<string>;
    encrypt(data: string | Buffer): Promise<EncryptionResult>;
    decrypt(encryptionResult: EncryptionResult): Promise<Buffer>;
    getKeyInfo(keyId: string): EncryptionKey | undefined;
    listKeys(): EncryptionKey[];
    private startKeyRotationSchedule;
    deriveKeyFromPassword(password: string, salt?: Buffer): Promise<Buffer>;
    exportKey(keyId: string, password: string): Promise<string>;
    importKey(encryptedKeyData: string, password: string): Promise<string>;
    secureDelete(keyId: string): Promise<void>;
    getKeyMetrics(): {
        totalKeys: number;
        activeKeys: number;
        rotatingKeys: number;
        deprecatedKeys: number;
        oldestKeyAge: number;
    };
    cleanup(): void;
}
export declare const keyManager: KeyManager;
//# sourceMappingURL=keyManager.d.ts.map