"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const soap = require("soap");
const fs = require("fs");
const path = require("path");
const BankIdError_1 = require("./Models/BankIdError");
const readFileAsync = (filePath, opts) => new Promise((res, rej) => {
    fs.readFile(filePath, opts, (err, data) => {
        if (err)
            rej(err);
        else
            res(data);
    });
});
class BankId {
    constructor(pfxCertPath, caCertPath, passphrase, production = false) {
        this.soapUrl = production
            ? "https://appapi2.bankid.com/rp/v4?wsdl"
            : "https://appapi2.test.bankid.com/rp/v4?wsdl";
        this.pfxCertPath = path.resolve(__dirname, pfxCertPath);
        this.caCertPath = path.resolve(__dirname, caCertPath);
        this.passphrase = passphrase;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.client || !this.init) {
                try {
                    const pfxData = (yield readFileAsync(this.pfxCertPath));
                    const caData = (yield readFileAsync(this.caCertPath, "utf-8"));
                    const options = {
                        wsdl_options: {
                            pfx: pfxData,
                            passphrase: this.passphrase,
                            ca: caData,
                        },
                    };
                    this.client = yield soap.createClientAsync(this.soapUrl, options);
                    this.client.setSecurity(new soap.ClientSSLSecurityPFX(pfxData, this.passphrase, {
                        caData,
                        rejectUnauthorized: false,
                    }));
                    this.inited = true;
                }
                catch (err) {
                    throw new BankIdError_1.BankIdError("Initialization failed");
                }
            }
        });
    }
    authenticate(personalNumber, options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
            const params = Object.assign({}, personalNumber ? { personalNumber: personalNumber } : {}, options);
            try {
                //soap methods are pascal cased bruuh :(
                return (yield this.client.AuthenticateAsync(params));
            }
            catch (err) {
                throw new BankIdError_1.BankIdError(err);
            }
        });
    }
    sign(userVisibleData, userNonVisibleData, personalNumber, options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
            if (userVisibleData.length > 40 * 1000) {
                //TODO add error message
                throw new BankIdError_1.BankIdError("CLIENT_ERROR", "User visible data exceeds 40k chars");
            }
            const base64nonVisibleData = new Buffer(userNonVisibleData).toString("base64");
            if (base64nonVisibleData.length > 200 * 1000) {
                //TODO add error message
                throw new BankIdError_1.BankIdError("CLIENT_ERROR", "User non-visible data exceeds 200k chars");
            }
            const params = Object.assign({}, personalNumber ? { personalNumber: personalNumber } : {}, {
                userVisibleData: userVisibleData,
                userNonVisibleData: base64nonVisibleData,
            }, options);
            try {
                return (yield this.client.SignAsync(params));
            }
            catch (err) {
                throw new BankIdError_1.BankIdError(err);
            }
        });
    }
    collect(orderRef, retryInterval = 2000, onEvent) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
            const normalizedInterval = Math.min(Math.max(1000, retryInterval), 10000);
            let error;
            let lastStatus;
            let interval;
            let inProgress = false;
            let result = {};
            let resolution;
            let called = false;
            const intervalFunction = () => __awaiter(this, void 0, void 0, function* () {
                if (!inProgress) {
                    try {
                        inProgress = true;
                        result = (yield this.client.CollectAsync(orderRef));
                        const progressStatus = result.progressStatus;
                        if (onEvent && progressStatus !== lastStatus) {
                            yield onEvent(progressStatus);
                        }
                        lastStatus = progressStatus;
                        inProgress = false;
                        if (progressStatus === "COMPLETE" ||
                            progressStatus === "NO_CLIENT" ||
                            progressStatus === "EXPIRED_TRANSACTION") {
                            clearInterval(interval);
                            called = true;
                            if (resolution !== undefined) {
                                resolution();
                            }
                            if (progressStatus === "NO_CLIENT" ||
                                progressStatus === "EXPIRED_TRANSACTION") {
                                error = new BankIdError_1.BankIdError(progressStatus);
                            }
                        }
                    }
                    catch (err) {
                        inProgress = false;
                        error = err;
                        clearInterval(interval);
                        called = true;
                        if (resolution !== undefined) {
                            resolution();
                        }
                    }
                }
            });
            interval = setInterval(intervalFunction, normalizedInterval);
            yield intervalFunction();
            yield new Promise((resolve) => {
                if (called) {
                    resolve();
                }
                else {
                    resolution = resolve;
                }
            });
            if (error) {
                throw error;
            }
            return result;
        });
    }
}
exports.default = BankId;
//# sourceMappingURL=index.js.map