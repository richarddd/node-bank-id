import * as soap from "soap";
import * as fs from "fs";
import * as path from "path";

import { BankIdOptions } from "./Models/BankIdOptions";
import { BankIdError } from "./Models/BankIdError";
import { CollectionResult } from "./Models/CollectionResult";
import { OrderResponse } from "./Models/OrderResponse";

const readFileAsync = (filePath, opts?: string) =>
  new Promise((res, rej) => {
    fs.readFile(filePath, opts, (err, data) => {
      if (err) rej(err);
      else res(data);
    });
  });

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

  async authenticate(
    personalNumber?: string,
    options?: BankIdOptions
  ): Promise<OrderResponse> {
    await this.init();

    const params = Object.assign(
      {},
      personalNumber ? { personalNumber: personalNumber } : {},
      options
    );

    try {
      //soap methods are pascal cased bruuh :(
      return (await this.client.AuthenticateAsync(params)) as OrderResponse;
    } catch (err) {
      throw new BankIdError(err);
    }
  }

  async sign(
    userVisibleData: string,
    userNonVisibleData: string,
    personalNumber?: string,
    options?: BankIdOptions
  ): Promise<OrderResponse> {
    await this.init();

    if (userVisibleData.length > 40 * 1000) {
      //TODO add error message
      throw new BankIdError(
        "CLIENT_ERROR",
        "User visible data exceeds 40k chars"
      );
    }

    const base64nonVisibleData = new Buffer(userNonVisibleData).toString(
      "base64"
    );
    if (base64nonVisibleData.length > 200 * 1000) {
      //TODO add error message
      throw new BankIdError(
        "CLIENT_ERROR",
        "User non-visible data exceeds 200k chars"
      );
    }

    const params = Object.assign(
      {},
      personalNumber ? { personalNumber: personalNumber } : {},
      {
        userVisibleData: userVisibleData,
        userNonVisibleData: base64nonVisibleData
      },
      options
    );

    try {
      return (await this.client.SignAsync(params)) as OrderResponse;
    } catch (err) {
      throw new BankIdError(err);
    }
  }

  async collect(
    orderRef: string,
    retryInterval: number = 2000,
    onEvent?: (status: string) => { void }
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
          result = (await this.client.CollectAsync(
            orderRef
          )) as CollectionResult;
          const progressStatus = result.progressStatus;
          if (onEvent && progressStatus !== lastStatus) {
            await onEvent(progressStatus);
          }
          lastStatus = progressStatus;
          inProgress = false;
          if (
            progressStatus === "COMPLETE" ||
            progressStatus === "NO_CLIENT" ||
            progressStatus === "EXPIRED_TRANSACTION"
          ) {
            clearInterval(interval);
            called = true;
            if (resolution !== undefined) {
              resolution();
            }

            if (
              progressStatus === "NO_CLIENT" ||
              progressStatus === "EXPIRED_TRANSACTION"
            ) {
              error = new BankIdError(progressStatus);
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

    await new Promise(resolve => {
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
