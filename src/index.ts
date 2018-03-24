import * as fs from "fs";
import * as https from "https";
import { parse } from "url";

const PRODUCTION_URL = "https://appapi2.bankid.com/rp/v5";
const TEST_URL = "https://appapi2.test.bankid.com/rp/v5";

export class CollectionResult {
  public static readonly FAILED: string = "failed";
  public static readonly PENDING: string = "pending";
  public static readonly COMPLETE: string = "complete";

  readonly completionData?: CompletionData;
  readonly orderRef: string;
  readonly status: string;
  readonly hintCode?: string;
}

export class BankIdError extends Error {
  message: string;
  errorCode?: string;

  constructor(message: string, errorCode?: string) {
    super(message);
    this.message = message;
    this.errorCode = errorCode;
  }
}

export interface CompletionData {
  user: {
    personalNumber: string;
    name: string;
    givenName: string;
    surname: string;
  };
  device: {
    ipAddress: string;
  };
  cert: {
    notBefore: string;
    notAfter: string;
  };
  signature: string;
  ocspResponse: string;
}

export interface BankIdOptions {
  readonly personalNumber?: string;
  readonly requirement?: Object;
}

export interface OrderResponse {
  orderRef: string;
  autoStartToken: string;
}

const readFileAsync = (filePath, opts?: string) =>
  new Promise((res, rej) => {
    fs.readFile(filePath, opts, (err, data) => {
      if (err) rej(err);
      else res(data);
    });
  });

export default class BankId {
  inited: boolean;
  passphrase: string;
  caCertPath: string;
  pfxCertPath: string;
  baseUrl: string;

  private pfxData: string;
  private caData: string;

  constructor(
    pfxCertPath: string,
    caCertPath: string,
    passphrase: string,
    production: boolean = false,
  ) {
    this.baseUrl = production ? PRODUCTION_URL : TEST_URL;

    this.pfxCertPath = pfxCertPath;
    this.caCertPath = caCertPath;
    this.passphrase = passphrase;
  }

  //dont want deps to axios, or other in lib
  private async post<T>(requestPath: string, data: Object): Promise<T> {
    const postData = JSON.stringify(data);

    const url = parse(this.baseUrl + requestPath);

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

    return new Promise<T>((resolve, reject) => {
      const req = https.request(options, (res) => {
        res.setEncoding("utf8");
        let resData = "";
        res.on("data", (chunk) => {
          resData += chunk;
        });
        res.on("end", () => {
          const responseObject = JSON.parse(resData);

          if (responseObject.errorCode) {
            throw new BankIdError(
              responseObject.details,
              responseObject.errorCode,
            );
          }

          resolve(<T>responseObject);
        });
      });

      req.write(postData);
      req.end();
    });
  }

  async init() {
    if (!this.inited) {
      try {
        this.pfxData = (await readFileAsync(this.pfxCertPath)) as string;
        this.caData = (await readFileAsync(this.caCertPath, "utf-8")) as string;
        this.inited = true;
      } catch (err) {
        const error = new BankIdError(err.message, "Initialization failed");
        error.stack = err.stack;
        throw error;
      }
    }
  }

  async cancel(orderRef: string): Promise<object> {
    await this.init();

    const body = { orderRef };

    return await this.post<object>("/cancel", body);
  }

  async authenticate(
    endUserIp: string,
    options?: BankIdOptions,
  ): Promise<OrderResponse> {
    await this.init();

    const body = { endUserIp, ...options };

    return await this.post<OrderResponse>("/auth", body);
  }

  async sign(
    endUserIp: string,
    userVisibleData: string,
    userNonVisibleData?: string,
    options?: BankIdOptions,
  ): Promise<OrderResponse> {
    await this.init();

    const base64UserVisibleData = new Buffer(userVisibleData).toString(
      "base64",
    );

    if (base64UserVisibleData.length > 40 * 1000) {
      throw new BankIdError("User visible data exceeds 40k chars");
    }

    let base64nonVisibleData: string | null = null;
    if (userNonVisibleData) {
      base64nonVisibleData = new Buffer(userNonVisibleData).toString("base64");
    }

    if (base64nonVisibleData && base64nonVisibleData.length > 200 * 1000) {
      throw new BankIdError("User non-visible data exceeds 200k chars");
    }

    const body = {
      endUserIp,
      userVisibleData: base64UserVisibleData,
      ...(userNonVisibleData
        ? { userNonVisibleData: base64nonVisibleData }
        : {}),
      ...options,
    };

    return await this.post<OrderResponse>("/sign", body);
  }

  async collect(
    orderRef: string,
    retryInterval: number = 2000,
    onEvent?: (status: string, hintCode: string) => Promise<void>,
  ): Promise<CollectionResult> {
    await this.init();

    const normalizedInterval = Math.min(Math.max(1000, retryInterval), 10000);

    let error;
    let lastStatus;
    let interval;
    let inProgress = false;
    let result: CollectionResult = {} as CollectionResult;
    let resolution;
    let called = false;

    const intervalFunction = async () => {
      if (!inProgress) {
        try {
          inProgress = true;
          result = (await this.post("/collect", {
            orderRef,
          })) as CollectionResult;
          const progressStatus = result.status;
          if (onEvent && progressStatus !== lastStatus) {
            await onEvent(
              progressStatus,
              result.hintCode ? result.hintCode : "",
            );
          }
          lastStatus = progressStatus;
          inProgress = false;
          if (
            progressStatus === CollectionResult.COMPLETE ||
            progressStatus === CollectionResult.FAILED
          ) {
            clearInterval(interval);
            called = true;
            if (resolution !== undefined) {
              resolution();
            }

            if (progressStatus === CollectionResult.FAILED) {
              error = new BankIdError(progressStatus, result.hintCode);
            }
          }
        } catch (err) {
          inProgress = false;
          error = err;
          clearInterval(interval);
          called = true;
          if (resolution !== undefined) {
            resolution();
          }
        }
      }
    };

    interval = setInterval(intervalFunction, normalizedInterval);
    await intervalFunction();

    await new Promise((resolve) => {
      if (called) {
        resolve();
      } else {
        resolution = resolve;
      }
    });

    if (error) {
      throw error;
    }

    return result;
  }
}
