export function validateRow(
    row: { [key: string]: string | number | null | undefined },
    requiredProps: string[]
): boolean {
    return requiredProps.every(prop => Object.keys(row).includes(prop) && !!row[prop]);
}

export type WriteMode = "append" | "overwrite" | "return";
