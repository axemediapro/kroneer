const crypto = require('crypto');

class ContractTokenService {
  /**
   * Merr çelësin e enkriptimit nga variablat e mjedisit ose fallback
   */
  static getSecretKey() {
    const secret = process.env.SESSION_SECRET || 'kroneer_contract_secret_key_2026';
    return crypto.createHash('sha256').update(secret).digest();
  }

  /**
   * Gjeneron një token publik të enkriptuar dhe të paprekshëm (tamper-proof) për kontratën
   * @param {Object} contract Kontrata ({ id, number, createdAt })
   * @returns {string} Token URL-safe
   */
  static generateToken(contract) {
    if (!contract || !contract.id) return null;

    const payload = JSON.stringify({
      id: contract.id,
      number: contract.number,
      cAt: contract.createdAt ? new Date(contract.createdAt).getTime() : Date.now()
    });

    const key = this.getSecretKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
    
    // Krijo HMAC signature për integritet
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(Buffer.concat([iv, encrypted]));
    const signature = hmac.digest(); // 32 bytes

    // Paketimi: [16 bytes IV][32 bytes Signature][Encrypted Payload]
    const combined = Buffer.concat([iv, signature, encrypted]);
    return combined.toString('base64url');
  }

  /**
   * Verifikon dhe dekripton token-in publik
   * @param {string} token Token-i i pranuar nga URL
   * @returns {Object|null} Payload { id, number, cAt } ose null nëse është i pavlefshëm
   */
  static verifyAndDecryptToken(token) {
    try {
      if (!token || typeof token !== 'string') return null;

      const combined = Buffer.from(token, 'base64url');
      if (combined.length < 48) return null; // 16 (IV) + 32 (HMAC) = 48 bytes min

      const iv = combined.subarray(0, 16);
      const signature = combined.subarray(16, 48);
      const encrypted = combined.subarray(48);

      const key = this.getSecretKey();

      // Verifiko HMAC signature
      const hmac = crypto.createHmac('sha256', key);
      hmac.update(Buffer.concat([iv, encrypted]));
      const expectedSignature = hmac.digest();

      if (!crypto.timingSafeEqual(signature, expectedSignature)) {
        return null;
      }

      // Dekripto
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      const data = JSON.parse(decrypted.toString('utf8'));

      if (!data || !data.id) return null;
      return data;
    } catch (err) {
      console.error('Gabim gjatë dekriptimit të token-it të kontratës:', err.message);
      return null;
    }
  }
}

module.exports = ContractTokenService;
