import * as soap from "soap";
import * as fs from "fs";
import * as path from "path";

const readFileAsync = (filePath, opts?: string) =>
  new Promise((res, rej) => {
    fs.readFile(filePath, opts, (err, data) => {
      if (err) rej(err);
      else res(data);
    });
  });

export class BankIdError {
  description: string;
  status: string;

  constructor(err) {
    if (typeof err === "string") {
      this.description = err;
      this.status = "ERROR";
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

export interface EndUserInfo {
  type: string;
  value: string;
}

export interface RequirementAlternative {
  requirement: RequirementAlternativeCondition;
}

export interface RequirementAlternativeCondition {
  key: string;
  value: string;
}

export interface BankIdOptions {
  readonly requirementAlternatives?: [RequirementAlternative];
  readonly endUserInfo?: [EndUserInfo];
}

export default class BankId {
  client?: any;
  inited: boolean;
  passphrase: string;
  caCertPath: string;
  pfxCertPath: string;
  soapUrl: string;

  constructor(
    pfxCertPath: string,
    caCertPath: string,
    passphrase: string,
    production: boolean = false
  ) {
    this.soapUrl = production
      ? "https://appapi2.bankid.com/rp/v4?wsdl"
      : "https://appapi2.test.bankid.com/rp/v4?wsdl";

    this.pfxCertPath = path.resolve(__dirname, pfxCertPath);
    this.caCertPath = path.resolve(__dirname, caCertPath);
    this.passphrase = passphrase;
  }

  async init() {
    if (!this.client || !this.init) {
      try {
        const pfxData = (await readFileAsync(this.pfxCertPath)) as string;
        const caData = (await readFileAsync(
          this.caCertPath,
          "utf-8"
        )) as string;

        const options = {
          wsdl_options: {
            pfx: pfxData,
            passphrase: this.passphrase,
            ca: caData
          }
        };
        this.client = await soap.createClientAsync(this.soapUrl, options);
        this.client.setSecurity(
          new soap.ClientSSLSecurityPFX(pfxData, this.passphrase, {
            caData,
            rejectUnauthorized: false
          })
        );

        this.inited = true;
      } catch (err) {
        throw new BankIdError("Initialization failed");
      }
    }
  }

  async authenticate(personalNumber: string, options?: BankIdOptions) {
    await this.init();

    const params = Object.assign(
      {},
      {
        personalNumber: personalNumber
      },
      options
    );

    try {
      //soap methods are pascal cased bruuh :(
      const result = await this.client.AuthenticateAsync(params);
      return result.orderRef;
    } catch (err) {
      throw new BankIdError(err);
    }
  }

  async sign(
    personalNumber: string,
    userVisibleData: string,
    userNonVisibleData: string,
    options: BankIdOptions
  ) {
    await this.init();

    if (userVisibleData.length > 40 * 1000) {
      //TODO add error message
      throw new BankIdError("User visible data exceeds 40k chars");
    }

    const base64nonVisibleData = new Buffer(userNonVisibleData).toString(
      "base64"
    );
    if (base64nonVisibleData.length > 200 * 1000) {
      //TODO add error message
      throw new BankIdError("User non-visible data exceeds 200k chars");
    }

    const params = Object.assign(
      {},
      {
        personalNumber: personalNumber,
        userVisibleData: userVisibleData,
        userNonVisibleData: base64nonVisibleData
      },
      options
    );

    try {
      //soap methods are pascal cased bruuh :(
      const result = await this.client.SignAsync(params);
      return result.orderRef;
    } catch (err) {
      throw new BankIdError(err);
    }
  }

  private sleep(ms) {
    let timerId, endTimer;
    class TimedPromise extends Promise<any> {
      isCanceled: boolean = false;
      cancel = () => {
        endTimer();
        clearTimeout(timerId);
        this.isCanceled = true;
      };
      constructor(fn) {
        super(fn);
      }
    }
    return new TimedPromise(resolve => {
      endTimer = resolve;
      timerId = setTimeout(endTimer, ms);
    });
  }

  async collect(
    orderRef: string,
    retryInterval: number = 2000,
    onEvent?: (status: string) => void
  ) {
    await this.init();

    const normalizedInterval = Math.min(Math.max(1000, retryInterval), 10000);

    let error;
    let lastStatus;
    let interval;
    let inProgress = false;
    let result;
    let resolution;

    const intervalFunction = async () => {
      if (!inProgress) {
        try {
          inProgress = true;
          result = await this.client.CollectAsync(orderRef);
          const progressStatus = result.progressStatus;
          if (onEvent && progressStatus !== lastStatus) {
            onEvent(progressStatus);
          }
          lastStatus = progressStatus;
          inProgress = false;
          if (progressStatus === "COMPLETE") {
            clearInterval(interval);
            resolution();
          }
        } catch (err) {
          inProgress = false;
          error = err;
          clearInterval(interval);
          resolution();
        }
      }
    };

    interval = setInterval(intervalFunction, normalizedInterval);
    await intervalFunction();

    await new Promise(resolve => {
      resolution = resolve;
    });

    if (error) {
      throw new BankIdError(error);
    }

    return result;
  }
}
