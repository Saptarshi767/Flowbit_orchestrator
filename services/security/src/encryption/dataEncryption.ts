import { keyManager, EncryptionResult } from './keyManager';

export interface EncryptedField {
  value: string;
  keyId: string;
  iv: string;
  authTag: string;
}

export class DataEncryption {
  async encryptSensitiveData(data: any): Promise<any> {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const encrypted = { ...data };
    
    // Define sensitive fields that should be encrypted
    const sensitiveFields = [
      'password', 'apiKey', 'secret', 'token', 'credential',
      'privateKey', 'connectionString', 'email', 'phone'
    ];

    for (const [key, value] of Object.entries(data)) {
      if (this.isSensitiveField(key, sensitiveFields) && typeof value === 'string') {
        encrypted[key] = await this.encryptField(value);
      } else if (typeof value === 'object' && value !== null) {
        encrypted[key] = await this.encryptSensitiveData(value);
      }
    }

    return encrypted;
  }

  async decryptSensitiveData(data: any): Promise<any> {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const decrypted = { ...data };

    for (const [key, value] of Object.entries(data)) {
      if (this.isEncryptedField(value)) {
        decrypted[key] = await this.decryptField(value as EncryptedField);
      } else if (typeof value === 'object' && value !== null) {
        decrypted[key] = await this.decryptSensitiveData(value);
      }
    }

    return decrypted;
  }

  private async encryptField(value: string): Promise<EncryptedField> {
    const result = await keyManager.encrypt(value);
    
    return {
      value: result.encryptedData.toString('base64'),
      keyId: result.keyId,
      iv: result.iv.toString('base64'),
      authTag: result.authTag.toString('base64')
    };
  }

  private async decryptField(encryptedField: EncryptedField): Promise<string> {
    const encryptionResult: EncryptionResult = {
      encryptedData: Buffer.from(encryptedField.value, 'base64'),
      keyId: encryptedField.keyId,
      iv: Buffer.from(encryptedField.iv, 'base64'),
      authTag: Buffer.from(encryptedField.authTag, 'base64')
    };

    const decrypted = await keyManager.decrypt(encryptionResult);
    return decrypted.toString('utf8');
  }

  private isSensitiveField(fieldName: string, sensitiveFields: string[]): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return sensitiveFields.some(sensitive => 
      lowerFieldName.includes(sensitive.toLowerCase())
    );
  }

  private isEncryptedField(value: any): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      'value' in value &&
      'keyId' in value &&
      'iv' in value &&
      'authTag' in value
    );
  }
}

export const dataEncryption = new DataEncryption();