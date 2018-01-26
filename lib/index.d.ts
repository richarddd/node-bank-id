import { BankIdOptions } from "./Models/BankIdOptions";
import { CollectionResult } from "./Models/CollectionResult";
export default class BankId {
    client?: any;
    inited: boolean;
    passphrase: string;
    caCertPath: string;
    pfxCertPath: string;
    soapUrl: string;
    constructor(pfxCertPath: string, caCertPath: string, passphrase: string, production?: boolean);
    init(): Promise<void>;
    authenticate(personalNumber: string, options?: BankIdOptions): Promise<any>;
    sign(personalNumber: string, userVisibleData: string, userNonVisibleData: string, options: BankIdOptions): Promise<any>;
    collect(orderRef: string, retryInterval?: number, onEvent?: (status: string) => void): Promise<CollectionResult>;
}
