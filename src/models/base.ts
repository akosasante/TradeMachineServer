import { isEqualWith, union } from "lodash";
import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { inspect } from "util";
import logger from "../bootstrap/logger";

export interface Excludes {
    [key: string]: boolean;
}

export interface HasEquals {
    equals(other: any, excludes?: Excludes, bypass?: boolean): boolean;
}

export class BaseModel {

    public static equals<T extends BaseModel>(self: T, other: T,
                                              excludes: Excludes = {}, complexFields: Excludes = {},
                                              modelFields: Excludes = {}): boolean {
        // Take the keys present in both instances
        const allFields = union(Object.keys(other), Object.keys(self));
        // Remove from the list any fields from the excludes map
        const includeOnly = allFields.filter(field => !excludes[field]);
        // props are any simple types that we can compare with isEqual
        const props = includeOnly.filter(field => !complexFields[field] && !modelFields[field]);
        // objects are any arrays/classes/objects.
        // Done separately so that we can log the particular deep fields that didn't match
        // These functions also allow for undefined
        const objects = includeOnly.filter(field => complexFields[field]);
        // model fields are things that extend BaseModel and have an .equals method themselves
        const models = includeOnly.filter(field => modelFields[field]);

        return propsEqual(props as Array<keyof T>, self, other) &&
            objectsEqual(objects as Array<keyof T>, self, other) &&
            modelsEqual(models as string[], self, other, excludes);
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
    logger.debug("comparing complex objects");
    return props.reduce((bool: boolean, prop: keyof T) => {
        const res = bool && objectEqual(prop, obj1, obj2);
        if (!res) {
            logger.debug(inspect(obj1[prop]));
            logger.debug(inspect(obj2[prop]));
            throw new Error("Not matching: " + prop);
        }
        return res;
    }, true);
}

function objectEqual<T extends BaseModel>(prop: keyof T, obj1: T, obj2: T): boolean {
    const coalesceNullAndUndefined = (val1: any, val2: any) =>
        (val1 === null || val1 === undefined) && (val2 === null || val2 === undefined) ? true : undefined;
    return isEqualWith(obj1[prop], obj2[prop], coalesceNullAndUndefined);
}

function propsEqual<T extends BaseModel>(props: Array<keyof T>, obj1: T, obj2: T): boolean {
    // key of T?
    return props.reduce((bool: boolean, prop: keyof T) => {
        const res = bool && propEqual(prop, obj1, obj2);
        if (!res) {
            logger.debug(`Mismatch between obj1: ${inspect(obj1[prop])} and obj2: ${inspect(obj2[prop])}`);
            throw new Error("Not matching: " + prop);
        }
        return res;
    }, true);
}

function propEqual<T extends BaseModel>(prop: keyof T, obj1: T, obj2: T): boolean {
    return (obj1[prop] || undefined) === (obj2[prop] || undefined);
}

function modelsEqual<T extends BaseModel>(keys: string[], obj1: T, obj2: T, excludes: Excludes): boolean {
    logger.debug("models equal check");
    return keys.reduce((bool: boolean, key: string) => {
        logger.debug("KEY: " + key);
        // @ts-ignore
        logger.debug(`${obj2[key]}`);
        // @ts-ignore
        if (obj1[key] && obj2[key] && obj1[key] instanceof Array && obj2[key] instanceof Array) {
            logger.debug("Is an array relation");
            let res;
            // @ts-ignore
            const obj1Length = obj1[key].length;
            // @ts-ignore
            const obj2Length = obj2[key].length;
            if (obj1Length !== obj2Length) {
                logger.debug(`obj1 (${obj1Length}) has a different amount of ${key} then obj2 (${obj2Length})`);
                throw new Error("Not matching: " + key);
            } else {
                logger.debug(`both objects have the same length of ${key}`);
                // @ts-ignore
                res = obj2[key].every((obj: T, index: number) => {
                    // @ts-ignore
                    logger.debug(`comparing ${obj} vs ${obj1[key][index]}`);
                    // @ts-ignore
                    return modelEqual(key, obj, obj1[key][index], excludes);
                });
            }
            if (!res) {
                throw new Error("Not matching: " + key);
            }
            return res;
        } else {
            logger.debug(`${key} is NOT an array. just check equals`);
            // @ts-ignore
            return bool && modelEqual(key, obj1[key], obj2[key], excludes);
        }
    }, true);
}

function isModel(object: any): object is HasEquals {
    return object ? "equals" in object : false;
}

function modelEqual<T extends BaseModel>(key: string, obj1: T, obj2: T, excludes: Excludes): boolean {
    const obj1Type = obj1 ? obj1.constructor.name : "isUndefined";
    const obj2Type = obj2 ? obj2.constructor.name : "isUndefined";
    if (!obj1 && !obj2) {
        logger.debug("both models are empty");
        return true;
    } else if (!obj1 || !obj2) {
        logger.debug("one of the models is empty");
        throw new Error(`Not matching: ${key}`);
    } else if (isModel(obj1) && isModel(obj2) && (obj1Type === obj2Type)) {
        logger.debug(`using ${obj1Type}.equals method with excludes: ${inspect(excludes)}`);
        return obj1.equals(obj2, excludes);
    } else {
        throw new Error(`Comparing two different models: ${obj1Type} and ${obj2Type}`);
    }
}
