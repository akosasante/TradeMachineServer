export function validateRow(row: object, requiredProps: string[]) {
    return requiredProps.every(prop => Object.keys(row).includes(prop));
}
