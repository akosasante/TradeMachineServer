import User from "./src/models/user";
import logger from "./src/bootstrap/logger";
import { inspect } from "util";
import { Emailer } from "./src/email/mailer";

async function test() {
    const mailer = Emailer;
    const user = new User({displayName: "Akosua", email: "tripleabatt@gmail.com"});
    logger.info("BEFORE");
    const res = await mailer.sendTestEmail(user);
    logger.info(`RESULT: ${inspect(res)}`);
}
test();
