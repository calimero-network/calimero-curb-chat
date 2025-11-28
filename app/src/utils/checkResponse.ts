export function checkCreateDMResponse(response: string | null | undefined): boolean {
    if (!response) {
        return false;
    }
    if (response.includes("DM already exists")) {
        return false;
    }
    if (response.includes("Failed to create DM")) {
        return false;
    }
    if (response.includes("Failed to create DM - creator not found")) {
        return false;
    }
    if (response.includes("Failed to create DM - creator userId not found")) {
        return false;
    }
    if (response.includes("Failed to create DM - executor public key not found")) {
        return false;
    }
    if (response.includes("You cannot invite yourself")) {
        return false;
    }
    return true;
}

export function checkCreateChannelResponse(response: string | null | undefined): boolean {
    if (!response) {
        return false;
    }
    if (response.includes("Channel already exists")) {
        return true;
    }
    if (response.includes("Failed to create channel")) {
        return true;
    }
    if (response.includes("Channel created")) {
        return false;
    }
    return true;
}