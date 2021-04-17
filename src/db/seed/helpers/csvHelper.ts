import axios from "axios";
import { promises } from "fs";

// tslint:disable:no-console

async function ensureDirectoryExists(tempPath: string) {
    return promises.mkdir(tempPath, {recursive: true});
}


export async function getCsvFromUrl(url: string, tempPath: string, csvName: string) {
    const fullPath = tempPath + csvName;
    console.log(`Downloading sheet from url: ${url}`);
    const {data} = await axios.get(`${url}`, {headers: {"Cache-Control": "max-age=60"}});
    console.log(`Ensuring ${tempPath} exists and saving ${csvName}`);
    await ensureDirectoryExists(tempPath)
        .then(() => promises.writeFile(fullPath, data));
    console.log("Save successful");
    return fullPath;
}
