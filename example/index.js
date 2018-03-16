const path = require("path");

const BankId = require("../lib/index").default;

const instance = new BankId(
  path.resolve(__dirname, "../cert/bankid-test.pfx"),
  path.resolve(__dirname, "../cert/bankid-test.crt"),
  "qwerty123",
);

//new requrement for v3
const ip = "192.168.1.1";

testAuth();
//testSign();
//testCancel();

//test for auth
function testAuth() {
  instance
    .authenticate(ip, { personalNumber: "190101014801" })
    .then((response) => {
      console.log("got order reference: ", response.orderRef);
      return instance.collect(response.orderRef, 1000, (status, hintCode) => {
        console.log("status, hintcode:", status, hintCode);
      });
    })
    .then((result) => {
      console.log("auth result: ", result);
    })
    .catch((e) => {
      console.log("something went wrong");
      console.error(e);
    });
}

//test for sign
function testSign() {
  instance
    .sign(ip, "This text will show", "This text is hidden", {
      personalNumber: "190101014801",
    })
    .then((response) => {
      console.log("got order reference: ", response.orderRef);
      return instance.collect(response.orderRef, 1000, (status, hintCode) => {
        console.log("status, hintcode:", status, hintCode);
      });
    })
    .then((result) => {
      console.log("sign result: ", result);
    })
    .catch((e) => {
      console.log("something went wrong");
      console.error(e);
    });
}

//test for cancel
function testCancel() {
  instance
    .sign(ip, "This text will show", "This text is hidden", {
      personalNumber: "190101014801",
    })
    .then((response) => {
      console.log("got order reference: ", response.orderRef);
      return instance.cancel(response.orderRef);
    })
    .then((result) => {
      console.log("cancel result: ", result);
    })
    .catch((e) => {
      console.log("something went wrong");
      console.error(e);
    });
}
