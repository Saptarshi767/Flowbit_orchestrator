import crypto from 'crypto';

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

export class KeyManager {
  private keys: Map<string, EncryptionKey> = new Map();
  private currentKeyId: string | null = null;
  private keyRotationInterval: NodeJS.Timeout | null = null;
  private keyDerivationSalt: Buffer;

  constructor() {
    this.keyDerivationSalt = crypto.randomBytes(32);
    this.initializeDefaultKey();
    this.startKeyRotationSchedule();
  }

  private initializeDefaultKey(): void {
    const keyId = crypto.randomUUID();
    const keyData = crypto.randomBytes(32); // 256-bit key
    
    const key: EncryptionKey = {
      id: keyId,
      algorithm: 'aes-256-cbc',
      keyData,
      createdAt: new Date(),
      status: 'active'
    };

    this.keys.set(keyId, key);
    this.currentKeyId = keyId;
  }

  async generateNewKey(): Promise<string> {
    const keyId = crypto.randomUUID();
    const keyData = crypto.randomBytes(32);
    
    const key: EncryptionKey = {
      id: keyId,
      algorithm: 'aes-256-cbc',
      keyData,
      createdAt: new Date(),
      status: 'active'
    };

    this.keys.set(keyId, key);
    return keyId;
  }

  async rotateKey(): Promise<string> {
    if (this.currentKeyId) {
      const currentKey = this.keys.get(this.currentKeyId);
      if (currentKey) {
        currentKey.status = 'rotating';
        currentKey.rotatedAt = new Date();
      }
    }

    const newKeyId = await this.generateNewKey();
    this.currentKeyId = newKeyId;
    return newKeyId;
  }

  async encrypt(data: string | Buffer): Promise<EncryptionResult> {
    if (!this.currentKeyId) {
      throw new Error('No active encryption key available');
    }

    const key = this.keys.get(this.currentKeyId);
    if (!key || key.status !== 'active') {
      throw new Error('Invalid or inactive encryption key');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key.keyData);
    
    const inputBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const encrypted = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);
    const authTag = crypto.createHmac('sha256', key.keyData).update(encrypted).digest();

    return {
      encryptedData: encrypted,
      keyId: key.id,
      iv,
      authTag
    };
  }

  async decrypt(encryptionResult: EncryptionResult): Promise<Buffer> {
    const key = this.keys.get(encryptionResult.keyId);
    if (!key) {
      throw new Error(`Encryption key ${encryptionResult.keyId} not found`);
    }

    // Verify auth tag
    const expectedAuthTag = crypto.createHmac('sha256', key.keyData).update(encryptionResult.encryptedData).digest();
    if (!crypto.timingSafeEqual(expectedAuthTag, encryptionResult.authTag)) {
      throw new Error('Authentication tag verification failed');
    }
    
    const decipher = crypto.createDecipher('aes-256-cbc', key.keyData);
    
    const decrypted = Buffer.concat([
      decipher.update(encryptionResult.encryptedData),
      decipher.final()
    ]);

    return decrypted;
  }

  getKeyInfo(keyId: string): EncryptionKey | undefined {
    return this.keys.get(keyId);
  }

  listKeys(): EncryptionKey[] {
    return Array.from(this.keys.values());
  }

  // Enhanced key management features
  private startKeyRotationSchedule(): void {
    // Rotate keys every 30 days (use smaller interval for testing)
    const rotationInterval = process.env.NODE_ENV === 'test' ? 60000 : 30 * 24 * 60 * 60 * 1000;
    this.keyRotationInterval = setInterval(() => {
      this.rotateKey().catch(error => {
        console.error('Automatic key rotation failed:', error);
      });
    }, rotationInterval);
  }

  async deriveKeyFromPassword(password: string, salt?: Buffer): Promise<Buffer> {
    const actualSalt = salt || this.keyDerivationSalt;
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, actualSalt, 100000, 32, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }

  async exportKey(keyId: string, password: string): Promise<string> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Key ${keyId} not found`);
    }

    const derivedKey = await this.deriveKeyFromPassword(password);
    const cipher = crypto.createCipher('aes-256-gcm', derivedKey);
    
    const keyData = JSON.stringify({
      id: key.id,
      algorithm: key.algorithm,
      keyData: key.keyData.toString('base64'),
      createdAt: key.createdAt.toISOString(),
      status: key.status
    });

    const encrypted = Buffer.concat([cipher.update(keyData, 'utf8'), cipher.final()]);
    return encrypted.toString('base64');
  }

  async importKey(encryptedKeyData: string, password: string): Promise<string> {
    const derivedKey = await this.deriveKeyFromPassword(password);
    const decipher = crypto.createDecipher('aes-256-gcm', derivedKey);
    
    const encrypted = Buffer.from(encryptedKeyData, 'base64');
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    
    const keyData = JSON.parse(decrypted.toString('utf8'));
    const key: EncryptionKey = {
      id: keyData.id,
      algorithm: keyData.algorithm,
      keyData: Buffer.from(keyData.keyData, 'base64'),
      createdAt: new Date(keyData.createdAt),
      status: keyData.status
    };

    this.keys.set(key.id, key);
    return key.id;
  }

  async secureDelete(keyId: string): Promise<void> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Key ${keyId} not found`);
    }

    // Overwrite key data with random bytes multiple times
    for (let i = 0; i < 3; i++) {
      crypto.randomFillSync(key.keyData);
    }

    this.keys.delete(keyId);
  }

  getKeyMetrics(): {
    totalKeys: number;
    activeKeys: number;
    rotatingKeys: number;
    deprecatedKeys: number;
    oldestKeyAge: number;
  } {
    const keys = Array.from(this.keys.values());
    const now = Date.now();
    
    return {
      totalKeys: keys.length,
      activeKeys: keys.filter(k => k.status === 'active').length,
      rotatingKeys: keys.filter(k => k.status === 'rotating').length,
      deprecatedKeys: keys.filter(k => k.status === 'deprecated').length,
      oldestKeyAge: keys.length > 0 ? 
        Math.min(...keys.map(k => now - k.createdAt.getTime())) : 0
    };
  }

  cleanup(): void {
    if (this.keyRotationInterval) {
      clearInterval(this.keyRotationInterval);
    }
  }
}

export const keyManager = new KeyManager();