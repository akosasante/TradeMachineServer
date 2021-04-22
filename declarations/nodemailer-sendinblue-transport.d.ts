// Type definitions for ./node_modules/nodemailer-sendinblue-transport/lib/nodemailer-sendinblue-transport.js
// Project: [LIBRARY_URL_HERE]
// Definitions by: [YOUR_NAME_HERE] <[YOUR_URL_HERE]>
// Definitions: https://github.com/borisyankov/DefinitelyTyped
// prefixedErr.!0
/* eslint-disable jsdoc/check-alignment, jsdoc/check-indentation, jsdoc/newline-after-description */
// eslint-disable-next-line
// import * as nodemaile_sendinblue from "/Users/aasante/h-dev/TradeMachine/trade-machine-server/node_modules/nodemailer-sendinblue-transport/lib/nodemailer-sendinblue-transport.js"
declare module "nodemailer-sendinblue-transport" {
/**
 *
 */
// declare interface 0 {
//
// 	/**
// 	 *
// 	 */
// 	message : string;
// }
// // addAddress.!0
//
// /**
//  *
//  */
// declare interface 0 {
// }
// // flattenGroups.!0
// type 0 = Array<any>;
// // flattenGroups.!ret
// type Ret = Array<any>;
// // transformAddress.!ret
// type Ret = Array<any>;
// // buildAttachment.!1
// type 1 = Array<any>;
// // buildAttachment.!2
//
// /**
//  *
//  */
// declare interface 2 {
// }
// // makeInfo.!ret
//
// /**
//  *
//  */
// declare interface Ret {
//
// 	/**
// 	 *
// 	 */
// 	messageId : string;
// }
// SendinBlueTransport.!0

/**
 *
 */
// declare interface 0 {
//
// 	/**
// 	 *
// 	 */
// 	apiUrl : string;
// }

/**
 * Constants
 */
const STATUS_OK: number;

/**
 * Helper
 * @param v
 * @return boolean
 */
function isUndefined(v: any): boolean;

/**
 *
 * @param v
 * @return boolean
 */
function isString(v: any): boolean;

/**
 *
 * @param v
 * @return boolean
 */
function isObject(v: any): boolean;

/**
 *
 * @param v
 * @return boolean
 */
function isArray(v: any): boolean;

/**
 *
 * @param v
 * @return boolean
 */
function isEmpty(v: {} | any[]): boolean;

/**
 *
 * @param err
 * @param prefix
 * @return Error
 */
function prefixedErr(err: Error, prefix: string): Error;

/**
 *
 * @param obj
 * @param address
 * @return {}
 */
function addAddress(obj: {}, address: any): {};

/**
 *
 * @param addresses
 * @return {}
 */
function flattenGroups(addresses: any[]): any[];

/**
 *
 * @param a
 * @return
 */
function transformAddress(a: any): any[]|undefined;

/**
 *
 * @param addresses
 */
function transformAddresses(addresses: any): any[]|undefined;

/**
 *
 * @param addresses
 * @return
 */
function transformFromAddresses(addresses: any): any[];

/**
 *
 * @param attachment
 * @param remote
 * @param generated
 * @return
 */
function buildAttachment(attachment: any, remote: any[], generated: {}|any[]): Promise<void>;

/**
 *
 * @param attachments
 * @return
 */
function buildAttachments(attachments: any): Promise<any[]>;

/**
 *
 * @param response
 * @return
 */
function isErrorResponse(response: any): boolean;

/**
 *
 * @param response
 * @param body
 * @return
 */
function responseError(response: any, body: any): Error;

/**
 *
 * @param body
 * @return
 */
function makeInfo(body: any): any;

// declare function SendinBlueTransport(options: any)

/**
 * Transport class
 */
class SendinBlueTransport {
    public name: string;
    public version: string;
    constructor(options: any);
    /**
	 *
	 * @param options
	 */
    // new (options : /* SendinBlueTransport.!0 */ any);

    /**
	 *
	 * @param mail
	 * @param callback
	 */
    // eslint-disable-next-line @typescript-eslint/ban-types
    public send(mail: any, callback: Function): Promise<any>;

    /**
	 *
	 * @param mail
	 * @return
	 */
    public buildBody(mail: any): /* SendinBlueTransport.prototype.+Promise */ any;
}

// /**
//  *
//  */
// declare namespace "./node_modules/nodemailer-sendinblue-transport/lib/nodemailer-sendinblue-transport.js"{
//
// 	/**
// 	 *
// 	 */
// 	interface Promise {
//
// 		/**
// 		 *
// 		 */
// 		:t : {
//
// 			/**
// 			 *
// 			 */
// 			from : Array</* string,? */ any>;
//
// 			/**
// 			 *
// 			 */
// 			replyto : /* Promise.:t.from */ any;
// 		}
// 	}
// }
function exported(options: any): SendinBlueTransport;
// @ts-ignore
export = exported;
}
