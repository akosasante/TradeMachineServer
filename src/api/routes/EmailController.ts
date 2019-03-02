import { Body, Controller, Post } from "routing-controllers";
import User from "../../models/user";

@Controller("/email")
export default class EmailController {
    // tslint:disable-next-line:no-empty
    constructor() {}

    @Post("/resetEmail")
    public async sendResetEmail(@Body() userObj: Partial<User>): Promise<void> {
        // Update current user with reset request time
        // Send email with current user
    }
}
