export interface EncryptedField {
    value: string;
    keyId: string;
    iv: string;
    authTag: string;
}
export declare class DataEncryption {
    encryptSensitiveData(data: any): Promise<any>;
    decryptSensitiveData(data: any): Promise<any>;
    private encryptField;
    private decryptField;
    private isSensitiveField;
    private isEncryptedField;
}
export declare const dataEncryption: DataEncryption;
//# sourceMappingURL=dataEncryption.d.ts.map