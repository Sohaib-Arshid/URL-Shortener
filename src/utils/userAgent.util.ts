import { UAParser } from 'ua-parser-js'

export interface ParsedUserAgent {
    device: string
    browser: string | null
    os: string | null
}

export const parseUserAgent = (uaString: string | null | undefined): ParsedUserAgent => {
    if (!uaString) {
        return { device: 'Desktop', browser: null, os: null }
    }

    const parser = new UAParser(uaString)
    const deviceType = parser.getDevice().type

    return {
        device: deviceType
            ? deviceType.charAt(0).toUpperCase() + deviceType.slice(1)
            : 'Desktop',
        browser: parser.getBrowser().name || null,
        os: parser.getOS().name || null,
    }
}