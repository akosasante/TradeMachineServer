import Bull from "bull";
import { processEmailJob } from "./processors";

const emailQueue = new Bull("email_queue");

emailQueue.process("reset_pass", processEmailJob);
emailQueue.process("registration_email", processEmailJob);
emailQueue.process("test_email", processEmailJob);
emailQueue.process("handle_webhook", processEmailJob);
