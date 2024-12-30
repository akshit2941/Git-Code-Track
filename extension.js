const { repositoryManager } = require('./utils/repoManage');
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
/**
 * Activates the extension.
 * @param {vscode.ExtensionContext} context - The extension context.
 */
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
            await context.workspaceState.update('githubConnectionStatus', 'Disconnected');
        }
    });

    let disposableCreateRepo = vscode.commands.registerCommand('extension.createGitTrackLogRepo', async () => {
        if (!octokit) {
            vscode.window.showErrorMessage('Please authenticate GitHub first.');
            return;
        }
        await createGitTrackLogRepo();
    });

    // Register the Show Commit Details command
    let disposableShowDetails = vscode.commands.registerCommand('extension.showCommitDetails', async () => {
        const activeTracking = context.workspaceState.get('activeTrackingStatus', false);
        const lastCommit = context.workspaceState.get('lastCommitTimestamp', 'N/A');
        const githubStatus = context.workspaceState.get('githubConnectionStatus', 'Disconnected');
        const syncStatus = context.workspaceState.get('syncStatus', 'Not synced yet.');

        const details =
            `**Active Tracking Status:** ${activeTracking ? 'Active' : 'Inactive'}\n` +
            `**Last Commit Timestamp:** ${lastCommit}\n` +
            `**GitHub Connection Status:** ${githubStatus}\n` +
            `**Sync Status with Remote Repository:** ${syncStatus}`;

        vscode.window.showInformationMessage(`Commit Details:\n${details}`);
    });

    // Register the Toggle Commit Tracking command
    let disposableToggleTracking = vscode.commands.registerCommand('extension.toggleCommitTracking', async () => {
        const currentStatus = context.workspaceState.get('activeTrackingStatus', true);
        await context.workspaceState.update('activeTrackingStatus', !currentStatus);
        vscode.window.showInformationMessage(`Commit Tracking ${!currentStatus ? 'Enabled' : 'Disabled'}.`);
    });

    // Create a status bar item for commit tracking
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'extension.showCommitDetails';
    statusBarItem.text = 'Commit Tracker: Active';
    statusBarItem.tooltip = 'Click to view commit details';
    statusBarItem.show();

    // Update status bar based on tracking status
    const updateStatusBar = () => {
        const isTrackingActive = context.workspaceState.get('activeTrackingStatus', false);
        statusBarItem.text = `Commit Tracker: ${isTrackingActive ? 'Active' : 'Inactive'}`;
    };

    // Initial status bar update
    updateStatusBar();

    // Listen for changes in active tracking status
    vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('activeTrackingStatus')) {
            updateStatusBar();
        }
    });

    // Initialize additional state details
    const isTrackingActive = true; // Assuming tracking is active by default
    await context.workspaceState.update('activeTrackingStatus', isTrackingActive);
    const githubStatus = context.workspaceState.get('githubConnectionStatus', 'Disconnected');
    await context.workspaceState.update('githubConnectionStatus', githubStatus);
    const currentSyncStatus = context.workspaceState.get('syncStatus', 'Not synced yet.');
    await context.workspaceState.update('syncStatus', currentSyncStatus);

    // Call repository manager to handle repository events
    repositoryManager(context);

    // Push disposables to subscriptions
    context.subscriptions.push(disposableAuth);
    context.subscriptions.push(disposableCreateRepo);
    context.subscriptions.push(disposableShowDetails);
    context.subscriptions.push(disposableToggleTracking);
    context.subscriptions.push(statusBarItem);
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}