const vscode = require('vscode');
const path = require('path');
const { Octokit } = require('@octokit/rest');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

let octokit;

async function createGitTrackLogRepo() {
    const repoName = 'git-track';
    try {
        // Check if the repository already exists
        await octokit.repos.get({
            owner: 'akshit2941',
            repo: repoName
        });
        vscode.window.showInformationMessage(`Repository '${repoName}' already exists.`);
    } catch (error) {
        if (error.status === 404) {
            // Repository does not exist, create it
            await octokit.repos.createForAuthenticatedUser({
                name: repoName,
                private: true,
                description: 'A common repository to track all the commits of the GitHub'
            });
            vscode.window.showInformationMessage(`Repository '${repoName}' created successfully.`);
        } else {
            vscode.window.showErrorMessage(`Error checking repository: ${error.message}`);
        }
    }
}

async function activate(context) {
    let disposableAuth = vscode.commands.registerCommand('extension.authenticateGitHub', async () => {
        try {
            // Define GitHub token directly in the code
            const token = process.env.GITHUB_TOKEN;

            if (!token) {
                throw new Error('Token is required');
            }

            // Initialize Octokit with token
            octokit = new Octokit({
                auth: token
            });

            // Verify authentication
            const { data } = await octokit.users.getAuthenticated();
            vscode.window.showInformationMessage(`Successfully authenticated as ${data.login}`);

        } catch (error) {
            vscode.window.showErrorMessage(`GitHub Authentication failed: ${error.message}`);
        }
    });

    let disposableCreateRepo = vscode.commands.registerCommand('extension.createGitTrackLogRepo', async () => {
        if (!octokit) {
            vscode.window.showErrorMessage('Please authenticate GitHub first.');
            return;
        }
        await createGitTrackLogRepo();
    });

    context.subscriptions.push(disposableAuth);
    context.subscriptions.push(disposableCreateRepo);
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}