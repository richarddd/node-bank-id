"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class BankIdError {
    constructor(err, description = "") {
        if (typeof err === "string") {
            this.description = description;
            this.status = err;
        }
        else {
            const fault = this.parse(err, "root.Envelope.Body.Fault.detail.RpFault");
            this.status = fault.faultStatus;
            this.description = fault.detailedDescription;
        }
    }
    parse(obj, key) {
        return key.split(".").reduce(function (o, x) {
            return typeof o === "undefined" || o === null ? o : o[x];
        }, obj);
    }
}
exports.BankIdError = BankIdError;
//# sourceMappingURL=BankIdError.js.map