const {
  DecryptCommand,
  EncryptCommand,
  KMSClient,
} = require('@aws-sdk/client-kms')
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} = require('@aws-sdk/lib-dynamodb')

const PASSWORD_TTL_SECONDS = 30 * 24 * 60 * 60
const PURPOSE = 'univent-organization-application-password'

function createOrganizationApplicationSecretStore(options = {}) {
  let kmsClient = options.kmsClient || null
  let documentClient = options.documentClient || null

  function getKmsClient() {
    if (!kmsClient) kmsClient = new KMSClient({})
    return kmsClient
  }

  function getDocumentClient() {
    if (!documentClient) {
      documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))
    }
    return documentClient
  }

  function getConfiguration() {
    const tableName = options.tableName || process.env.ORGANIZATION_APPLICATION_PASSWORDS_TABLE
    const keyArn = options.keyArn || process.env.ORGANIZATION_APPLICATION_PASSWORDS_KEY_ARN
    if (!tableName || !keyArn) {
      throw new Error('Organization application password encryption is not configured.')
    }
    return { tableName, keyArn }
  }

  function encryptionContext(applicationId) {
    return { applicationId, purpose: PURPOSE }
  }

  async function storePassword(applicationId, password, expiresAt) {
    const { tableName, keyArn } = getConfiguration()
    const encrypted = await getKmsClient().send(
      new EncryptCommand({
        KeyId: keyArn,
        Plaintext: Buffer.from(password, 'utf8'),
        EncryptionContext: encryptionContext(applicationId),
      }),
    )
    if (!encrypted.CiphertextBlob) {
      throw new Error('KMS did not return an encrypted organization password.')
    }

    await getDocumentClient().send(
      new PutCommand({
        TableName: tableName,
        Item: {
          applicationId,
          ciphertext: Buffer.from(encrypted.CiphertextBlob).toString('base64'),
          expiresAt,
        },
        ConditionExpression: 'attribute_not_exists(#applicationId)',
        ExpressionAttributeNames: { '#applicationId': 'applicationId' },
      }),
    )
  }

  async function getPassword(applicationId) {
    const { tableName, keyArn } = getConfiguration()
    const result = await getDocumentClient().send(
      new GetCommand({
        TableName: tableName,
        Key: { applicationId },
        ConsistentRead: true,
      }),
    )
    const secret = result.Item
    if (
      !secret
      || typeof secret.ciphertext !== 'string'
      || secret.ciphertext.length === 0
      || !Number.isSafeInteger(secret.expiresAt)
      || secret.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null
    }

    const decrypted = await getKmsClient().send(
      new DecryptCommand({
        KeyId: keyArn,
        CiphertextBlob: Buffer.from(secret.ciphertext, 'base64'),
        EncryptionContext: encryptionContext(applicationId),
      }),
    )
    if (!decrypted.Plaintext) {
      throw new Error('KMS did not return the organization application password.')
    }
    return Buffer.from(decrypted.Plaintext).toString('utf8')
  }

  async function deletePassword(applicationId) {
    const { tableName } = getConfiguration()
    await getDocumentClient().send(
      new DeleteCommand({
        TableName: tableName,
        Key: { applicationId },
      }),
    )
  }

  return { storePassword, getPassword, deletePassword }
}

const defaultStore = createOrganizationApplicationSecretStore()

module.exports = {
  PASSWORD_TTL_SECONDS,
  createOrganizationApplicationSecretStore,
  ...defaultStore,
}
