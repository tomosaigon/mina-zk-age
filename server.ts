import Router from 'koa-router';
import Koa from 'koa';

import { Age } from './build/src/Age.js';
import {
  isReady,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Signature,
} from 'snarkyjs';

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

let deployerAccount: PrivateKey,
  zkAppAddress: PublicKey,
  zkAppPrivateKey: PrivateKey;

console.debug('await isReady');
await isReady;
if (proofsEnabled) Age.compile();

deployerAccount = createLocalBlockchain();
zkAppPrivateKey = PrivateKey.random();
// console.debug('zkAppPrivateKey', zkAppPrivateKey);
zkAppAddress = zkAppPrivateKey.toPublicKey();
const zkAppInstance = new Age(zkAppAddress);
await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

const app = new Koa();
const router = new Router();

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

router.get('/', (ctx) => {
  ctx.body = 'Hello, World!';
});
router.get('/pubkey', (ctx) => {
  const oraclePublicKey = zkAppInstance.oraclePublicKey.get();
  ctx.body = JSON.stringify(oraclePublicKey);
});
router.get('/user/:id/:session/age', async (ctx) => {
  // lookup KYC, get age, prove it
  const data = await getSignedAge(ctx.params.id);
  const id = Field(data.data.id);
  const age = Field(data.data.age);
  const signature = Signature.fromJSON(data.signature);
  await Mina.transaction(deployerAccount, () => {
    zkAppInstance.verify(
      id,
      age,
      signature ?? fail('something is wrong with the signature')
    );
  });
  ctx.body = `Hello user ${ctx.params.id}, authenticated with session ${ctx.params.session}!`;
});

app.use(router.routes());

const port = 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
