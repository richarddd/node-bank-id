export class BankIdError {
  description: string;
  status: string;

  constructor(err, description: string = "") {
    if (typeof err === "string") {
      this.description = description;
      this.status = err;
    } else {
      const fault = this.parse(err, "root.Envelope.Body.Fault.detail.RpFault");
      this.status = fault.faultStatus;
      this.description = fault.detailedDescription;
    }
  }

  private parse(obj, key) {
    return key.split(".").reduce(function(o, x) {
      return typeof o === "undefined" || o === null ? o : o[x];
    }, obj);
  }
}
