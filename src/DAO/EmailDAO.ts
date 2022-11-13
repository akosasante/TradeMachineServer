import { FindOneOptions, getConnection, Repository } from "typeorm";
import Email from "../models/email";

export default class EmailDAO {
    private emailDb: Repository<Email>;

    constructor(repo?: Repository<Email>) {
        this.emailDb = repo || getConnection(process.env.ORM_CONFIG).getRepository("Email");
    }

    public async createEmail(email: Partial<Email>): Promise<Email> {
        return await this.emailDb.save(email);
    }

    public async getEmailByMessageId(id: string): Promise<Email | null> {
        return await this.emailDb.findOne({ where: { messageId: id } } as FindOneOptions<Email>);
    }

    public async updateEmail(email: Partial<Email>): Promise<Email> {
        return await this.emailDb.save(email);
    }
}
