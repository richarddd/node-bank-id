const BankId = require("../lib/index").default;

const instance = new BankId(
  "../cert/bankid-test.pfx",
  "../cert/bankid-test.crt",
  "qwerty123"
);

instance
  .authenticate("190101014801")
  .then(response => {
    console.log("got order reference: ", response.orderRef);
    return instance.collect(response.orderRef, 1000, status => {
      console.log("status:", status);
    });
  })
  .then(result => {
    console.log("result: ", result);
  })
  .catch(e => {
    console.error(e);
  });
