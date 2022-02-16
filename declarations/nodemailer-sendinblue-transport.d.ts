declare module "nodemailer-sendinblue-transport" {
declare function _exports(options: sendInBlueTransportOptions): SendinBlueTransport;
export = _exports;
export interface SendInBlueTransportOptions {
	apiUrl?: string;
	apiKey?: string | null;
}
// eslint-disable-next-line @typescript-eslint/naming-convention
declare function SendinBlueTransport(options: SendInBlueTransportOptions): SendinBlueTransport;
declare class SendinBlueTransport extends SMTPTransport {
    constructor(options: SendInBlueTransportOptions);
    name: string;
    version: string;
    reqOptions: url.UrlWithStringQuery;
    reqBuilder: typeof https.request;
    send(mail: MailMessage<SMTPTransport.SentMessageInfo>, callback: (err: Error | null, info: SMTPTransport.SentMessageInfo) => void): void;
    buildBody(mail: MailMessage<SMTPTransport.SentMessageInfo>): Promise<Mail.Options>;
}
import url = require("url");
import https = require("https");
import Promise = require("promise");
import SMTPTransport = require("nodemailer/lib/smtp-transport");
import MailMessage = require("nodemailer/lib/mailer/mail-message");
import Mail from "nodemailer/lib/mailer";
}

