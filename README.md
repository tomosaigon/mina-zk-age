# Mina zkApp: Mina Zk Age

Allow a customer to prove to a merchant they're above a certain age by submitting a proof transaction to Mina that emits an event if proof is successful. The event will publish a code provided by the merchant such as an order ID. The contract will check the age field in a signed attestation provided by the KYC provider whose public key is written in the contract. Merchants only need to trust the contract code and the KYC provider's public key is correct amd watch for their unique order ID to be emitted on Mina. 

Berkley testnet is currently down so rum this on a local blockchain. The Koa server will start a blockchain and use it while the server is running. 

run it with: 
```
ts-node-esm server.ts
```

## How to build

```sh
npm run build
```

## How to run tests

```sh
npm run test
npm run testw # watch mode
```

## How to run coverage

```sh
npm run coverage
```

## License

[Apache-2.0](LICENSE)
