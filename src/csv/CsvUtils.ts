export function validateRow(row: object, requiredProps: string[]) {
    // @ts-ignore
    return requiredProps.every(prop => Object.keys(row).includes(prop) && !!row[prop]);
}

export type WriteMode = "append"|"overwrite";
