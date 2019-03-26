import { isEqual, union } from "lodash";
import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export interface Excludes {
    [key: string]: boolean;
}

export class BaseModel {

    public static equals<T extends BaseModel>(self: T, other: T,
                                              excludes: Excludes = {}, complexFields: Excludes = {}): boolean {
        // Take the keys present in both instances
        const allFields = union(Object.keys(other), Object.keys(self));
        // Remove from the list any fields from the excludes map
        const includeOnly = allFields.filter(field => !excludes[field]);
        // props are any simple types that we can compare with isEqual
        const props = includeOnly.filter(field => !complexFields[field]);
        // objects are any arrays/classes/objects.
        // Done separately so that we can log the particular deep fields that didn't match
        // These functions also allow for undefined
        const objects = includeOnly.filter(field => complexFields[field]);

        return propsEqual(props as Array<keyof T>, self, other) &&
            objectsEqual(objects as Array<keyof T>, self, other);
    }
    @PrimaryGeneratedColumn()
    public readonly id?: number;

    @CreateDateColumn()
    public dateCreated?: Date;

    @UpdateDateColumn()
    public dateModified?: Date;

    // tslint:disable-next-line
    constructor() {}

    public toString(): string {
        return `${this.constructor.name}#${this.id}`;
    }

    public parse<T extends BaseModel>(): Partial<T> {
        return Object.assign({}, this);
    }
}

function objectsEqual<T extends BaseModel>(props: Array<keyof T>, obj1: T, obj2: T): boolean {
    return props.reduce((bool: boolean, prop: keyof T) => {
        const res = bool && objectEqual(prop, obj1, obj2);
        if (!res) {
            throw new Error("Not matching: " + prop);
        }
        return res;
    }, true);
}

function objectEqual<T extends BaseModel>(prop: keyof T, obj1: T, obj2: T): boolean {
    return isEqual(obj1[prop], obj2[prop]);
}

function propsEqual<T extends BaseModel>(props: Array<keyof T>, obj1: T, obj2: T): boolean {
    // key of T?
    return props.reduce((bool: boolean, prop: keyof T) => {
        const res = bool && propEqual(prop, obj1, obj2);
        if (!res) {
            throw new Error("Not matching: " + prop);
        }
        return res;
    }, true);
}

function propEqual<T extends BaseModel>(prop: keyof T, obj1: T, obj2: T): boolean {
    return (obj1[prop] || undefined) === (obj2[prop] || undefined);
}
