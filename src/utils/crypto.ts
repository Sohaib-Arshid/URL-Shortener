import crypto from "crypto";

export function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

const BASE62_CHARSET =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateShortCode(length: number = 7): string {
    const bytes = crypto.randomBytes(length);
    let code = "";

    for (let i = 0; i < length; i++) {
        code += BASE62_CHARSET[bytes[i] % BASE62_CHARSET.length];
    }

    return code;
}