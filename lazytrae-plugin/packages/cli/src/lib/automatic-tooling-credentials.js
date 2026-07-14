const crypto = require('crypto');

function encryptCredential(input) {
  if (!input.approval || input.approval.kind !== 'allowed') throw new Error('credential encryption requires approval');
  if (!Buffer.isBuffer(input.dataKey) || input.dataKey.length !== 32) throw new Error('credential data key must be 256 bits');
  if (typeof input.keyId !== 'string' || !input.keyId.startsWith('keychain:')) throw new Error('credential key id must be a Keychain reference');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', input.dataKey, iv);
  const ciphertext = Buffer.concat([cipher.update(input.credential, 'utf8'), cipher.final()]);
  return { version: 1, key_id: input.keyId, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}

function decryptCredential(input) {
  if (!input.approval || input.approval.kind !== 'allowed') throw new Error('credential decryption requires approval');
  const record = input.record;
  if (!record || record.version !== 1 || typeof record.key_id !== 'string' || !record.key_id.startsWith('keychain:')) throw new Error('encrypted credential record is invalid');
  if (!Buffer.isBuffer(input.dataKey) || input.dataKey.length !== 32) throw new Error('credential data key must be 256 bits');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', input.dataKey, Buffer.from(record.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  } catch (_) {
    throw new Error('encrypted credential cannot be decrypted with its Keychain key version');
  }
}

function readVersionedDataKey(input) {
  if (!input.approval || input.approval.kind !== 'allowed') throw new Error('Keychain data-key read requires approval');
  if (typeof input.reference !== 'string' || !input.reference.startsWith('keychain:') || typeof input.keychainRead !== 'function') throw new Error('Keychain data-key reference is invalid');
  const key = Buffer.from(input.keychainRead(input.reference), 'base64');
  if (key.length !== 32) throw new Error('Keychain data key must be 256 bits');
  return key;
}

function chooseCredentialReference(references, availability) {
  const keychain = references && references.keychain;
  const environment = references && references.environment;
  const encrypted = references && references.encrypted;
  if (typeof keychain === 'string' && keychain.startsWith('keychain:') && availability.hasKeychain) return { kind: 'keychain', reference: keychain };
  if (typeof environment === 'string' && environment.startsWith('env:')) {
    const name = environment.slice('env:'.length);
    if (Object.hasOwn(availability.environment || {}, name)) return { kind: 'environment', reference: environment, name };
  }
  if (typeof encrypted === 'string' && encrypted.startsWith('encrypted:') && availability.hasEncrypted) return { kind: 'encrypted', reference: encrypted };
  return null;
}

module.exports = { chooseCredentialReference, decryptCredential, encryptCredential, readVersionedDataKey };
