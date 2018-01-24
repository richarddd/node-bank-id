import * as BankId from "./index";

const bankid = new BankId({
  production: false, // use test environment
  pfx: "./cert/bankid-test.pfx",
  passphrase: "qwerty123", // test environment
  ca: "./cert/bankid-test.crt"
});
const pno = "190101014801";
const message = "message";

const test = () => {
  bankid
    .authenticate(pno)
    .then(res => {
      const timer = setInterval(() => {
        const done = () => clearInterval(timer);

        bankid
          .collect(res.orderRef)
          .then(res2 => {
            console.log(res2.progressStatus);

            if (res2.progressStatus === "COMPLETE") {
              console.log(res2.userInfo);
              done();
            }
          })
          .catch(err => {
            console.log(err.toString());
            done();
          });
      }, 1000);
    })
    .catch(err => {
      console.log(err.toString());
    });
};

export default test;
