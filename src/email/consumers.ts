import Bull from "bull";
import { processEmailJob } from "./processors";

const emailQueue = new Bull("email_queue");

/* TODO: if we're going this way, we could probably also update the processors? maybe it's not even worth it to
 have named jobs idk */
emailQueue.process("reset_pass", processEmailJob);
emailQueue.process("registration_email", processEmailJob);
emailQueue.process("test_email", processEmailJob);
emailQueue.process("handle_webhook", processEmailJob);
