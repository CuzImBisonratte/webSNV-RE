// Modules
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const prompts = require("prompts");
var config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));

// Set up cookie storage
var cookie = {
    sessionid: "",
    SNVWebPortalSessionID: "",
    HASH_SNVWebPortalSessionID: ""
};

/* --------------------- */
/* - Helper  Functions - */
/* --------------------- */

// Show banner
function showBanner() {
    console.log("┌" + ("─".repeat(78)) + "┐");
    console.log("│" + (" ".repeat(78)) + "│");
    console.log("│" + (" ".repeat(32)) + "\x1b[33m\x1b[1mSNV CLI v0.1.0\x1b[0m" + (" ".repeat(32)) + "│");
    console.log("│" + (" ".repeat(78)) + "│");
    console.log("│" + (" ".repeat(14)) + "\x1b[31mSNV CLI is not affiliated with SchulNetzVerwalter.\x1b[0m" + (" ".repeat(14)) + "│");
    console.log("│" + (" ".repeat(17)) + "\x1b[31mThis is free software. Use at your own risk.\x1b[0m" + (" ".repeat(17)) + "│");
    console.log("│" + (" ".repeat(78)) + "│");
    console.log("└" + ("─".repeat(78)) + "┘");
    console.log("\n");
}

// User output
function userOutput(message, type = "info") {
    const icon = (() => {
        switch (type) {
            case "info":
                return "\x1b[36mℹ";
            case "success":
                return "\x1b[32m✔";
            case "warning":
                return "\x1b[33m⚠";
            case "error":
                return "\x1b[31m✖";
        }
    })();
    console.log(icon + "\x1b[0m " + message);
}

/* --------------------- */
/* - SNV-API Functions - */
/* --------------------- */

// Format cookie
function formatCookie() {
    var cookieString = "";
    for (var key in cookie) {
        cookieString += key + "=" + cookie[key] + ";";
    }
    return cookieString;
}

// Query the SNV Web Portal
async function querySNV(params) {
    const options = {
        method: 'GET',
        url: "https://" + config.snvURL + "/snvmodules",
        params: params,
        headers: { Cookie: formatCookie() }
    };
    try {
        const response = await axios.request(options);
        return response.headers;
    } catch (error) {
        console.error(error);
    }
}

// Check if SNV Web Portal is reachable
async function checkSNV() {
    try {
        await axios.get("https://" + config.snvURL + "/snvmodules?method=checksession").then((response) => {
            if (response.headers.method && response.headers.method == 'checksession') return 1;
            return 0;
        });
    } catch (error) {
        return 0;
    }
}

/* --------------------- */
/* -- Main  Functions -- */
/* --------------------- */

// promptURL
async function promptURL() {
    // Check if snvURL is already saved
    if (config.snvURL == "" || config.snvURL == undefined) {
        // Get snvURL
        await (async () => {
            const response = await prompts({
                type: "text",
                name: "snvURL",
                message: "Enter the URL of your school's SNV Web Portal"
            });
            // Cut off to base URL (remove protocol and trailing slash)
            response.snvURL = response.snvURL.replace(/(^\w+:|^)\/\//, "").replace(/\/$/, "");
            config.snvURL = response.snvURL;
        })();
    }
    // Check if URL is valid
    await checkSNV()
        .then(async (data) => {
            if (data == 0) {
                userOutput("SNV Web Portal is not reachable. Please check the URL.", "error");
                config.snvURL = "";
                await promptURL();
                return;
            } else {
                // Show school name
                await querySNV({
                    method: 'checksession'
                }).then((data) => {
                    const [plz, ...ort] = data.lnplzort.split("-");
                    userOutput("School found: " + data.lnname + ", " + ort.join("-"), "success");
                });
            }
        });
}

// Login
async function login() {
    // Check if config.json contains credentials
    if (config.username == "" || config.password == "" || config.username == undefined || config.password == undefined) {
        console.log("\nPlease enter your SNV Web Portal credentials to log in.");
        // Ask for username
        await (async () => {
            const response = await prompts({
                type: "text",
                name: "username",
                message: "Username"
            });
            config.username = response.username;
        })();
        // Ask for password
        await (async () => {
            const response = await prompts({
                type: "password",
                name: "password",
                message: "Password"
            });
            config.password = response.password;
        })();
    }
    // Login
    await querySNV({
        method: 'auth',
        username: config.username,
        password: config.password
    }).then(async (data) => {
        // Check if login was successful
        if (data.resultcode == -1) {
            userOutput("Login failed. Please check your credentials.", "error");
            config.username = "";
            config.password = "";
            await login();
            return;
        }
        cookie.sessionid = data.sessionid;
        var cookieString = data["set-cookie"];
        cookieString.forEach((element) => {
            if (element.includes("HASH_SNVWebPortalSessionID")) cookie.HASH_SNVWebPortalSessionID = element.split(";")[0].split("=")[1];
            else if (element.includes("SNVWebPortalSessionID")) cookie.SNVWebPortalSessionID = element.split(";")[0].split("=")[1];
        });
        userOutput("Logged in as: " + config.username, "success");
    });
}

// Main function
async function main() {
    // This is needed to catch CTRL+C (see https://github.com/terkelg/prompts/issues/252#issuecomment-2424555811)
    process.stdin.on("keypress", function (_chunk, key) {
        if (key && key.name === "c" && key.ctrl) {
            process.stdout.write("\x1B[?25h\n");
            process.exit(130);
        }
    });
    showBanner();
    await promptURL();
    await login();
}
main();
