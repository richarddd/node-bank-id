import { BankIdOptions } from "./Models/BankIdOptions";
import { CollectionResult } from "./Models/CollectionResult";
import { OrderResponse } from "./Models/OrderResponse";
export default class BankId {
    client?: any;
    inited: boolean;
    passphrase: string;
    caCertPath: string;
    pfxCertPath: string;
    soapUrl: string;
    constructor(pfxCertPath: string, caCertPath: string, passphrase: string, production?: boolean);
    init(): Promise<void>;
    authenticate(personalNumber?: string, options?: BankIdOptions): Promise<OrderResponse>;
    sign(personalNumber: string, userVisibleData: string, userNonVisibleData: string, options: BankIdOptions): Promise<OrderResponse>;
    collect(orderRef: string, retryInterval?: number, onEvent?: (status: string) => {
        void;
    }): Promise<CollectionResult>;
}
