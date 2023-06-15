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

router.get('/', (ctx) => {
  ctx.body = 'Hello, World!';
});
router.get('/pubkey', (ctx) => {
  const oraclePublicKey = zkAppInstance.oraclePublicKey.get();
  ctx.body = JSON.stringify(oraclePublicKey);
});
router.get('/user/:id/:session/age', (ctx) => {
  ctx.body = `Hello user ${ctx.params.id}, authenticated with session ${ctx.params.session}!`;
});

app.use(router.routes());

const port = 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
