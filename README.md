# API integration against BankId

```json
const BankId = require("../lib/BankId").default;

const instance = new BankId(
  "../cert/bankid-test.pfx",
  "../cert/bankid-test.crt",
  "qwerty123"
);

instance
  .authenticate("190101014801")
  .then(orderRef => {
    console.log("got order reference: ", orderRef);
    return instance.collect(orderRef, 1000, status => {
      console.log("status:", status);
    });
  })
  .then(result => {
    console.log("result: ", result);
  })
  .catch(e => {
    console.error(e);
  });
```
