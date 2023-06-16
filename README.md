# Mina zkApp: Mina Zk Age

Allow a customer to prove to a merchant they're above a certain age by submitting a proof transaction to Mina that emits an event if proof is successful. The event will publish a code provided by the merchant such as an order ID. The contract will check the age field in a signed attestation provided by the KYC provider whose public key is written in the contract. Merchants only need to trust the contract code and the KYC provider's public key is correct amd watch for their unique order ID to be emitted on Mina. 

A wallet integrated with this KYC provider will authenticate the customer then process requests from the customer who sends a merchant code they want to verify their age for. The api will look like:

```
/user/:id/age/:merchantCode
```

If successful, this will make a transaction on Mina using the server's Mina wallet so the customer doesn't need one. There will be another api endpoint to return a Mina transaction to the user if they want to send it themselves. 

Note: Berkley testnet is currently down so rum this on a local blockchain. The Koa server will start a blockchain and use it while the server is running. Merchants need to watch the blockchain by connecting to a rpc and listening for events. 

run it with: 
```
ts-node-esm server.ts
```

## How to build contracts

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
