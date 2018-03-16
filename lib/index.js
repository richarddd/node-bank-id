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
const fs = require("fs");
const https = require("https");
const url_1 = require("url");
const PRODUCTION_URL = "https://appapi2.bankid.com/rp/v5";
const TEST_URL = "https://appapi2.test.bankid.com/rp/v5";
class CollectionResult {
}
CollectionResult.FAILED = "failed";
CollectionResult.PENDING = "pending";
CollectionResult.COMPLETE = "complete";
exports.CollectionResult = CollectionResult;
class BankIdError extends Error {
    constructor(message, errorCode) {
        super(message);
        this.message = message;
        this.errorCode = errorCode;
    }
}
exports.BankIdError = BankIdError;
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
        this.baseUrl = production ? PRODUCTION_URL : TEST_URL;
        this.pfxCertPath = pfxCertPath;
        this.caCertPath = caCertPath;
        this.passphrase = passphrase;
    }
    //dont want deps to axios, or other in lib
    post(requestPath, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const postData = JSON.stringify(data);
            const url = url_1.parse(this.baseUrl + requestPath);
            const options = {
                host: url.host,
                path: url.path,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                pfx: this.pfxData,
                ca: this.caData,
                rejectUnauthorized: false,
                passphrase: this.passphrase,
            };
            options["agent"] = new https.Agent(options);
            return new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    res.setEncoding("utf8");
                    let resData = "";
                    res.on("data", (chunk) => {
                        resData += chunk;
                    });
                    res.on("end", () => {
                        const responseObject = JSON.parse(resData);
                        if (responseObject.errorCode) {
                            throw new BankIdError(responseObject.details, responseObject.errorCode);
                        }
                        resolve(responseObject);
                    });
                });
                req.write(postData);
                req.end();
            });
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.inited) {
                try {
                    this.pfxData = (yield readFileAsync(this.pfxCertPath));
                    this.caData = (yield readFileAsync(this.caCertPath, "utf-8"));
                    this.inited = true;
                }
                catch (err) {
                    const error = new BankIdError(err.message, "Initialization failed");
                    error.stack = err.stack;
                    throw error;
                }
            }
        });
    }
    cancel(orderRef) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
            const body = { orderRef };
            return yield this.post("/cancel", body);
        });
    }
    authenticate(endUserIp, options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
            const body = Object.assign({ endUserIp }, options);
            return yield this.post("/auth", body);
        });
    }
    sign(endUserIp, userVisibleData, userNonVisibleData, options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
            const base64UserVisibleData = new Buffer(userVisibleData).toString("base64");
            if (base64UserVisibleData.length > 40 * 1000) {
                throw new BankIdError("User visible data exceeds 40k chars");
            }
            let base64nonVisibleData = null;
            if (userNonVisibleData) {
                base64nonVisibleData = new Buffer(userNonVisibleData).toString("base64");
            }
            if (base64nonVisibleData && base64nonVisibleData.length > 200 * 1000) {
                throw new BankIdError("User non-visible data exceeds 200k chars");
            }
            const body = Object.assign({ endUserIp, userVisibleData: base64UserVisibleData }, (userNonVisibleData
                ? { userNonVisibleData: base64nonVisibleData }
                : {}), options);
            return yield this.post("/sign", body);
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
                        result = (yield this.post("/collect", {
                            orderRef,
                        }));
                        const progressStatus = result.status;
                        if (onEvent && progressStatus !== lastStatus) {
                            yield onEvent(progressStatus, result.hintCode ? result.hintCode : "");
                        }
                        lastStatus = progressStatus;
                        inProgress = false;
                        if (progressStatus === CollectionResult.COMPLETE ||
                            progressStatus === CollectionResult.FAILED) {
                            clearInterval(interval);
                            called = true;
                            if (resolution !== undefined) {
                                resolution();
                            }
                            if (progressStatus === CollectionResult.FAILED) {
                                error = new BankIdError(progressStatus, result.hintCode);
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