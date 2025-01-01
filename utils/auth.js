const vscode = require('vscode');
const { Octokit } = require('@octokit/rest');

async function authenticate(context) {
    console.log('Debug: Authentication started');

    // Ensure context is provided and valid
    if (!context) {
        throw new Error('Extension context is undefined');
    }

    if (!context.secrets) {
        throw new Error('Extension secrets API is unavailable');
    }

    const secretKey = 'githubAuthToken';

    try {
        // Check for existing token
        let token = await context.secrets.get(secretKey);

        if (!token) {
            // Prompt user for authentication method
            const choice = await vscode.window.showQuickPick(
                ['Enter Token Manually', 'Use OAuth (Under Development)'],
                {
                    placeHolder: 'Select authentication method',
                    ignoreFocusOut: true
                }
            );

            if (!choice) {
                throw new Error('Authentication cancelled by user');
            }

            if (choice === 'Enter Token Manually') {
                token = await vscode.window.showInputBox({
                    prompt: 'Enter your GitHub Personal Access Token',
                    ignoreFocusOut: true,
                    password: true
                });

                if (!token) {
                    throw new Error('GitHub token is required');
                }

                await context.secrets.store(secretKey, token);
                vscode.window.showInformationMessage('GitHub token saved securely');
            } else {
                throw new Error('OAuth authentication is not available');
            }
        }

        return await initializeOctokit(token);
    } catch (error) {
        console.error('Authentication error:', error);
        vscode.window.showErrorMessage(`Authentication failed: ${error.message}`);
        throw error;
    }
}


async function initializeOctokit(token) {
    if (!token) {
        throw new Error('Token is required for initialization');
    }

    const octokit = new Octokit({ auth: token });

    try {
        const { data } = await octokit.users.getAuthenticated();
        // vscode.window.showInformationMessage(`Authenticated as ${data.login}`);
        return { octokit, login: data.login };
    } catch (error) {
        throw new Error(`Failed to authenticate: ${error.message}`);
    }
}

module.exports = { authenticate };
