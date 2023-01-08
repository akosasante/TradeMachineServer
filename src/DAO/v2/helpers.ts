export function exclude<T, Key extends keyof T>(model: T, ...keys: Key[]): Omit<T, Key> {
    for (const key of keys) {
        delete model[key];
    }
    return model;
}

export function convertParamsToWhereQuery(params: string[]): { [field: string]: string }[] {
    return params.map(paramStr => {
        const [field, value] = paramStr.split(".");
        return { [field]: value };
    });
}
