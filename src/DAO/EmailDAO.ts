import { getConnection, Repository } from "typeorm";
import Email from "../models/email";

export default class EmailDAO {
    private emailDb: Repository<Email>;

    constructor(repo?: Repository<Email>) {
        this.emailDb = repo || getConnection(process.env.NODE_ENV).getRepository("Email");
    }

    public async getEmailByMessageId(id: string): Promise<Email | undefined> {
        return await this.emailDb.findOne(id);
    }

    public async updateEmail(email: Email): Promise<Email> {
        return await this.emailDb.save(email);
    }
}
