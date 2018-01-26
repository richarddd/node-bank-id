export declare class BankIdError {
    description: string;
    status: string;
    constructor(err: any, description?: string);
    private parse(obj, key);
}
