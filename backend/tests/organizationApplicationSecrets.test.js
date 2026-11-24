const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const requireFromFunctions = createRequire(require.resolve('../functions/package.json'))
const {
  DecryptCommand,
  EncryptCommand,
} = requireFromFunctions('@aws-sdk/client-kms')
const {
  PutCommand,
  GetCommand,
  DeleteCommand,
} = requireFromFunctions('@aws-sdk/lib-dynamodb')
const {
  createOrganizationApplicationSecretStore,
  PASSWORD_TTL_SECONDS,
} = require('../functions/lib/organizationApplicationSecrets')

const infrastructureTemplate = readFileSync(
  path.resolve(__dirname, '../../infrastructure/template.yaml'),
  'utf8',
)

function resourceBlock(resourceName) {
  const start = infrastructureTemplate.indexOf(`  ${resourceName}:\n`)
  assert.notEqual(start, -1, `Missing ${resourceName} resource`)
  const nextResource = /\n  [A-Za-z][A-Za-z0-9]*:\n/g
  nextResource.lastIndex = start + 1
  const next = nextResource.exec(infrastructureTemplate)
  return infrastructureTemplate.slice(start, next ? next.index + 1 : undefined)
}

function statementBlock(block, sid) {
  const start = block.indexOf(`- Sid: ${sid}`)
  assert.notEqual(start, -1, `Missing ${sid} statement`)
  const next = block.indexOf('\n          - Sid:', start + 1)
  return block.slice(start, next === -1 ? undefined : next)
}

describe('organization application password encryption', () => {
  it('grants context-bound key cryptography to the configured execution role', () => {
    const key = resourceBlock('OrganizationApplicationPasswordsKey')
    assert.match(key, /EnableKeyRotation: false/)
    const keyAdmin = statementBlock(key, 'KeyAdministrationWithoutCryptographicUse')
    const academyAdmin = statementBlock(key, 'VoclabsKeyPolicyUpdates')
    const cryptography = statementBlock(key, 'OrganizationApplicationPasswordCryptography')
    const applicationRole = resourceBlock('OrganizationApplicationsRole')
    const applicationFunction = resourceBlock('OrganizationApplicationsFunction')

    assert.match(keyAdmin, /AWS: !Sub 'arn:\$\{AWS::Partition\}:iam::\$\{AWS::AccountId\}:root'/)
    assert.match(keyAdmin, /aws:PrincipalArn: !Sub 'arn:\$\{AWS::Partition\}:iam::\$\{AWS::AccountId\}:root'/)
    assert.doesNotMatch(keyAdmin, /kms:(?:Encrypt|Decrypt|GenerateDataKey|ReEncrypt)\b|kms:\*/)

    assert.match(academyAdmin, /AWS: !Sub 'arn:\$\{AWS::Partition\}:iam::\$\{AWS::AccountId\}:role\/voclabs'/)
    assert.match(academyAdmin, /kms:DescribeKey/)
    assert.match(academyAdmin, /kms:GetKeyPolicy/)
    assert.match(academyAdmin, /kms:PutKeyPolicy/)
    assert.doesNotMatch(academyAdmin, /Condition:/)
    assert.doesNotMatch(academyAdmin, /kms:(?:Encrypt|Decrypt|GenerateDataKey|ReEncrypt)\b|kms:\*/)

    assert.match(
      cryptography,
      /AWS: !If \[UseSuppliedRole, !Ref LambdaExecutionRoleArn, !GetAtt OrganizationApplicationsRole\.Arn\]/,
    )
    assert.match(cryptography, /kms:Encrypt/)
    assert.match(cryptography, /kms:Decrypt/)
    assert.match(
      cryptography,
      /kms:EncryptionContext:purpose: univent-organization-application-password/,
    )
    assert.match(cryptography, /kms:EncryptionContext:applicationId: '\?\*'/)
    assert.equal((key.match(/^\s+- kms:Encrypt$/gm) || []).length, 1)
    assert.equal((key.match(/^\s+- kms:Decrypt$/gm) || []).length, 1)
    assert.doesNotMatch(key, /kms:\*/)
    assert.match(applicationRole, /Condition: CreateExecutionRoles/)
    assert.doesNotMatch(applicationRole, /kms:(?:Encrypt|Decrypt)\b/)
    assert.match(
      applicationFunction,
      /Role: !If \[UseSuppliedRole, !Ref LambdaExecutionRoleArn, !GetAtt OrganizationApplicationsRole\.Arn\]/,
    )
    assert.doesNotMatch(key, /LabRole/)
  })

  it('stores only KMS ciphertext and decrypts with an application-bound context', async () => {
    const calls = []
    let secretItem
    const kmsClient = {
      async send(command) {
        calls.push(command)
        if (command instanceof EncryptCommand) {
          assert.equal(command.input.Plaintext.toString(), 'StrongPass123')
          return { CiphertextBlob: Buffer.from('encrypted-password') }
        }
        assert.ok(command instanceof DecryptCommand)
        assert.equal(command.input.CiphertextBlob.toString(), 'encrypted-password')
        return { Plaintext: Buffer.from('StrongPass123') }
      },
    }
    const documentClient = {
      async send(command) {
        calls.push(command)
        if (command instanceof PutCommand) {
          secretItem = command.input.Item
          return {}
        }
        if (command instanceof GetCommand) return { Item: secretItem }
        if (command instanceof DeleteCommand) {
          secretItem = undefined
          return {}
        }
        throw new Error(`Unexpected command: ${command.constructor.name}`)
      },
    }
    const secretStore = createOrganizationApplicationSecretStore({
      kmsClient,
      documentClient,
      tableName: 'OrganizationApplicationPasswords',
      keyArn: 'kms-key',
    })
    const expiresAt = Math.floor(Date.now() / 1000) + PASSWORD_TTL_SECONDS

    await secretStore.storePassword('application-1', 'StrongPass123', expiresAt)

    assert.equal(secretItem.applicationId, 'application-1')
    assert.equal(secretItem.expiresAt, expiresAt)
    assert.equal(secretItem.ciphertext, Buffer.from('encrypted-password').toString('base64'))
    assert.equal(Object.values(secretItem).includes('StrongPass123'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(secretItem, 'password'), false)
    assert.deepEqual(calls[0].input.EncryptionContext, {
      applicationId: 'application-1',
      purpose: 'univent-organization-application-password',
    })
    assert.equal(await secretStore.getPassword('application-1'), 'StrongPass123')
    assert.deepEqual(calls[3].input.EncryptionContext, calls[0].input.EncryptionContext)

    await secretStore.deletePassword('application-1')
    assert.equal(secretItem, undefined)
  })

  it('does not decrypt secrets with missing, invalid, or expired expiry values', async () => {
    const now = Math.floor(Date.now() / 1000)
    const invalidSecrets = [
      ['missing', { applicationId: 'application-invalid', ciphertext: 'encrypted' }],
      ['null', { applicationId: 'application-invalid', ciphertext: 'encrypted', expiresAt: null }],
      ['nonnumeric', { applicationId: 'application-invalid', ciphertext: 'encrypted', expiresAt: 'never' }],
      ['numeric string', { applicationId: 'application-invalid', ciphertext: 'encrypted', expiresAt: '4102444800' }],
      ['NaN', { applicationId: 'application-invalid', ciphertext: 'encrypted', expiresAt: Number.NaN }],
      ['infinite', { applicationId: 'application-invalid', ciphertext: 'encrypted', expiresAt: Number.POSITIVE_INFINITY }],
      ['fractional', { applicationId: 'application-invalid', ciphertext: 'encrypted', expiresAt: now + 0.5 }],
      ['expired', { applicationId: 'application-invalid', ciphertext: 'encrypted', expiresAt: now - 1 }],
      ['at expiry', { applicationId: 'application-invalid', ciphertext: 'encrypted', expiresAt: now }],
    ]

    for (const [label, Item] of invalidSecrets) {
      let decryptCount = 0
      const secretStore = createOrganizationApplicationSecretStore({
        kmsClient: {
          async send() {
            decryptCount += 1
            return { Plaintext: Buffer.from('not-used') }
          },
        },
        documentClient: {
          async send(command) {
            assert.ok(command instanceof GetCommand)
            return { Item }
          },
        },
        tableName: 'OrganizationApplicationPasswords',
        keyArn: 'kms-key',
      })

      assert.equal(await secretStore.getPassword('application-invalid'), null, label)
      assert.equal(decryptCount, 0, `${label} expiry must not reach KMS`)
    }
  })
})
