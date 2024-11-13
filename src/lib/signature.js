import crypto from 'crypto';
import httpSignature from 'http-signature';

export class SignatureHandler {
  static async verifySignature(req) {
    try {
      const parsed = httpSignature.parseRequest(req);
      const publicKey = await this.fetchPublicKey(parsed.keyId);
      
      return httpSignature.verifySignature(parsed, publicKey);
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  static async fetchPublicKey(keyId) {
    try {
      const response = await fetch(keyId);
      const actor = await response.json();
      return actor.publicKey.publicKeyPem;
    } catch (error) {
      console.error('Failed to fetch public key:', error);
      throw error;
    }
  }

  static signRequest(req, privateKey) {
    const signer = crypto.createSign('sha256');
    const signature = signer.update(req.body).sign(privateKey, 'base64');
    
    return {
      signature,
      algorithm: 'rsa-sha256'
    };
  }
}