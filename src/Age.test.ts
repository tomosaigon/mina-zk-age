import { jest } from '@jest/globals';
import { Age } from './Age';
import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Signature,
} from 'snarkyjs';

// The public key of our trusted data provider
const ORACLE_PUBLIC_KEY =
  'B62qoAE4rBRuTgC42vqvEyUqCGhaZsW58SKVW4Ht8aYqP9UTvxFWBgy';

let proofsEnabled = false;
function createLocalBlockchain() {
  const Local = Mina.LocalBlockchain({ proofsEnabled });
  Mina.setActiveInstance(Local);
  return Local.testAccounts[0].privateKey;
}

async function localDeploy(
  zkAppInstance: Age,
  zkAppPrivatekey: PrivateKey,
  deployerAccount: PrivateKey
) {
  console.debug('in localDeploy');
  const txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    zkAppInstance.deploy({ zkappKey: zkAppPrivatekey });
    zkAppInstance.init(zkAppPrivatekey);
  });
  // console.debug('prove');
  await txn.prove();
  txn.sign([zkAppPrivatekey]);
  // console.debug('send');
  await txn.send();
}

async function getSignedAge(userId: string) {
  // We need to wait for SnarkyJS to finish loading before we can do anything
  await isReady;

  // The private key of our account. When running locally the hardcoded key will
  // be used. In production the key will be loaded from a Vercel environment
  // variable.
  const privateKey = PrivateKey.fromBase58(
    process.env.PRIVATE_KEY ??
      'EKF65JKw9Q1XWLDZyZNGysBbYG21QbJf3a4xnEoZPZ28LKYGMw53'
  );

  const knownAge = (userId: string) => (userId === '1' ? 25 : 15);

  // We compute the public key associated with our private key
  const publicKey = privateKey.toPublicKey();

  // Define a Field with the value of the users id
  const id = Field(userId);

  // Define age Field
  const age = Field(knownAge(userId));

  // Use our private key to sign an array of Fields containing the users id, age
  const signature = Signature.create(privateKey, [id, age]);

  return {
    data: { id: id, age: age },
    signature: signature,
    publicKey: publicKey,
  };
}

describe('AgeOracle', () => {
  let deployerAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey;

  beforeAll(async () => {
    console.debug('await isReady');

    await isReady;
    if (proofsEnabled) Age.compile();
  });

  beforeEach(async () => {
    deployerAccount = createLocalBlockchain();
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
  });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    console.debug('await shutdown');
    setTimeout(shutdown, 800);
  });

  it('generates and deploys the `Age` oracle smart contract', async () => {
    const zkAppInstance = new Age(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const oraclePublicKey = zkAppInstance.oraclePublicKey.get();
    expect(oraclePublicKey).toEqual(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));
  });

  jest.setTimeout(60000);

  describe('actual API requests', () => {
    it('emits an `id` event containing the users id if their age is above 700 and the provided signature is valid', async () => {
      // jest.setTimeout(60000);
      const zkAppInstance = new Age(zkAppAddress);
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

      // const response = await fetch(
      //   // 'http://localhost:3000/user/1'
      //   'https://mina-credit-score-signer-pe3eh.ondigitalocean.app/user/1'
      // );
      // console.debug('response', response);
      // const data = await response.json();
      const data = await getSignedAge('1');
      console.debug('data', data); // XXX

      const id = Field(data.data.id);
      const age = Field(data.data.age);
      const signature = Signature.fromJSON(data.signature);
      // console.debug('signature', signature);

      const txn = await Mina.transaction(deployerAccount, () => {
        zkAppInstance.verify(
          id,
          age,
          signature ?? fail('something is wrong with the signature')
        );
      });
      await txn.prove();
      await txn.send();

      const events = await zkAppInstance.fetchEvents();
      const verifiedEventValue = events[0].event.toFields(null)[0];
      console.debug('verifiedEventValue', verifiedEventValue);
      expect(verifiedEventValue).toEqual(id);
    });

    it('throws an error if the age is below 700 even if the provided signature is valid', async () => {
      const zkAppInstance = new Age(zkAppAddress);
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

      // const response = await fetch(
      //   'https://mina-credit-score-signer-pe3eh.ondigitalocean.app/user/2'
      //   // 'http://localhost:3000/user/2'
      // );
      // const data = await response.json();
      const data = await getSignedAge('2');

      const id = Field(data.data.id);
      const age = Field(data.data.age);
      const signature = Signature.fromJSON(data.signature);

      expect(async () => {
        await Mina.transaction(deployerAccount, () => {
          zkAppInstance.verify(
            id,
            age,
            signature ?? fail('something is wrong with the signature')
          );
        });
      }).rejects;
    });
  });

  describe('hardcoded values', () => {
    it('emits an `id` event containing the users id if their age is above 18 and the provided signature is valid', async () => {
      const zkAppInstance = new Age(zkAppAddress);
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

      const id = Field(1);
      const age = Field(28);
      const signature = Signature.fromJSON({
        r: '13209474117923890467777795933147746532722569254037337512677934549675287266861',
        s: '12079365427851031707052269572324263778234360478121821973603368912000793139475',
      });

      const txn = await Mina.transaction(deployerAccount, () => {
        zkAppInstance.verify(
          id,
          age,
          signature ?? fail('something is wrong with the signature')
        );
      });
      await txn.prove();
      await txn.send();

      const events = await zkAppInstance.fetchEvents();
      const verifiedEventValue = events[0].event.toFields(null)[0];
      expect(verifiedEventValue).toEqual(id);
    });

    it('throws an error if the age is below 18 even if the provided signature is valid', async () => {
      const zkAppInstance = new Age(zkAppAddress);
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

      const id = Field(2);
      const age = Field(16);
      const signature = Signature.fromJSON({
        r: '25163915754510418213153704426580201164374923273432613331381672085201550827220',
        s: '20455871399885835832436646442230538178588318835839502912889034210314761124870',
      });

      expect(async () => {
        await Mina.transaction(deployerAccount, () => {
          zkAppInstance.verify(
            id,
            age,
            signature ?? fail('something is wrong with the signature')
          );
        });
      }).rejects;
    });

    it('throws an error if the age is above 18 and the provided signature is invalid', async () => {
      const zkAppInstance = new Age(zkAppAddress);
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

      const id = Field(1);
      const age = Field(87);
      const signature = Signature.fromJSON({
        r: '26545513748775911233424851469484096799413741017006352456100547880447752952428',
        s: '7381406986124079327199694038222605261248869991738054485116460354242251864564',
      });

      expect(async () => {
        await Mina.transaction(deployerAccount, () => {
          zkAppInstance.verify(
            id,
            age,
            signature ?? fail('something is wrong with the signature')
          );
        });
      }).rejects;
    });
  });
});
