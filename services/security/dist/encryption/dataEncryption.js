"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataEncryption = exports.DataEncryption = void 0;
const keyManager_1 = require("./keyManager");
class DataEncryption {
    async encryptSensitiveData(data) {
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
            }
            else if (typeof value === 'object' && value !== null) {
                encrypted[key] = await this.encryptSensitiveData(value);
            }
        }
        return encrypted;
    }
    async decryptSensitiveData(data) {
        if (typeof data !== 'object' || data === null) {
            return data;
        }
        const decrypted = { ...data };
        for (const [key, value] of Object.entries(data)) {
            if (this.isEncryptedField(value)) {
                decrypted[key] = await this.decryptField(value);
            }
            else if (typeof value === 'object' && value !== null) {
                decrypted[key] = await this.decryptSensitiveData(value);
            }
        }
        return decrypted;
    }
    async encryptField(value) {
        const result = await keyManager_1.keyManager.encrypt(value);
        return {
            value: result.encryptedData.toString('base64'),
            keyId: result.keyId,
            iv: result.iv.toString('base64'),
            authTag: result.authTag.toString('base64')
        };
    }
    async decryptField(encryptedField) {
        const encryptionResult = {
            encryptedData: Buffer.from(encryptedField.value, 'base64'),
            keyId: encryptedField.keyId,
            iv: Buffer.from(encryptedField.iv, 'base64'),
            authTag: Buffer.from(encryptedField.authTag, 'base64')
        };
        const decrypted = await keyManager_1.keyManager.decrypt(encryptionResult);
        return decrypted.toString('utf8');
    }
    isSensitiveField(fieldName, sensitiveFields) {
        const lowerFieldName = fieldName.toLowerCase();
        return sensitiveFields.some(sensitive => lowerFieldName.includes(sensitive.toLowerCase()));
    }
    isEncryptedField(value) {
        return (typeof value === 'object' &&
            value !== null &&
            'value' in value &&
            'keyId' in value &&
            'iv' in value &&
            'authTag' in value);
    }
}
exports.DataEncryption = DataEncryption;
exports.dataEncryption = new DataEncryption();
//# sourceMappingURL=dataEncryption.js.map