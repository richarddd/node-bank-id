export declare class CollectionResult {
    static readonly FAILED: string;
    static readonly PENDING: string;
    static readonly COMPLETE: string;
    readonly completionData?: CompletionData;
    readonly orderRef: string;
    readonly status: string;
    readonly hintCode?: string;
}
export declare class BankIdError extends Error {
    message: string;
    errorCode?: string;
    constructor(message: string, errorCode?: string);
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
export default class BankId {
    inited: boolean;
    passphrase: string;
    caCertPath: string;
    pfxCertPath: string;
    baseUrl: string;
    private pfxData;
    private caData;
    constructor(pfxCertPath: string, caCertPath: string, passphrase: string, production?: boolean);
    private post<T>(requestPath, data);
    init(): Promise<void>;
    cancel(orderRef: string): Promise<object>;
    authenticate(endUserIp: string, options?: BankIdOptions): Promise<OrderResponse>;
    sign(endUserIp: string, userVisibleData: string, userNonVisibleData?: string, options?: BankIdOptions): Promise<OrderResponse>;
    collect(orderRef: string, retryInterval?: number, onEvent?: (status: string, hintCode: string) => Promise<void>): Promise<CollectionResult>;
}
