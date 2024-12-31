const { repositoryManager } = require('./utils/repoManage');
const vscode = require('vscode');
const path = require('path');
const { Octokit } = require('@octokit/rest');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

let octokit;
let trackingManager = null;


async function createGitTrackLogRepo() {
    const repoName = 'git-track';
    try {
        await octokit.repos.get({
            owner: 'akshit2941',
            repo: repoName
        });
        vscode.window.showInformationMessage(`Repository ready for tracking.`);
    } catch (error) {
        if (error.status === 404) {
            try {
                await octokit.repos.createForAuthenticatedUser({
                    name: repoName,
                    private: true,
                    description: 'A common repository to track all the commits of the GitHub'
                });
                vscode.window.showInformationMessage(`Common repository created successfully.`);
            } catch (createError) {
                vscode.window.showErrorMessage(`Error creating repository: ${createError.message}`);
            }
        } else {
            vscode.window.showErrorMessage(`Error checking repository: ${error.message}`);
        }
    }
}

/**
 * Initializes GitHub authentication.
 */
async function initializeGitHub(context) {
    try {
        const token = process.env.GITHUB_TOKEN;

        if (!token) {
            throw new Error('GitHub token not found. Please set GITHUB_TOKEN in .env file.');
        }

        octokit = new Octokit({ auth: token });
        const { data } = await octokit.users.getAuthenticated();

        vscode.window.showInformationMessage(`Successfully authenticated as ${data.login}`);
        await context.workspaceState.update('githubConnectionStatus', 'Connected');

        // Create repository after successful authentication
        await createGitTrackLogRepo();

    } catch (error) {
        vscode.window.showErrorMessage(`GitHub Authentication failed: ${error.message}`);
        await context.workspaceState.update('githubConnectionStatus', 'Disconnected');
    }
}

/**
 * Activates the extension.
 * @param {vscode.ExtensionContext} context - The extension context.
 */
async function activate(context) {
    // Initialize tracking status as inactive
    await context.workspaceState.update('activeTrackingStatus', false);

    // Automatically initialize GitHub on startup
    await initializeGitHub(context);

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

    let disposableToggleTracking = vscode.commands.registerCommand('extension.toggleCommitTracking', async () => {
        const currentStatus = context.workspaceState.get('activeTrackingStatus', false);

        if (!currentStatus) {
            // Starting tracking
            if (!octokit) {
                vscode.window.showErrorMessage('GitHub authentication failed. Please check your token and try restarting VS Code.');
                return;
            }
            trackingManager = await repositoryManager(context);
            vscode.window.showInformationMessage('Commit Tracking Started');
        } else {
            // Stopping tracking
            if (trackingManager) {
                trackingManager = null;
            }
            vscode.window.showInformationMessage('Commit Tracking Stopped');
        }

        await context.workspaceState.update('activeTrackingStatus', !currentStatus);
        updateStatusBar();
    });

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'extension.showCommitDetails';
    statusBarItem.text = 'Commit Tracker: Inactive';
    statusBarItem.tooltip = 'Click to view commit details';
    statusBarItem.show();

    const updateStatusBar = () => {
        const isTrackingActive = context.workspaceState.get('activeTrackingStatus', false);
        statusBarItem.text = `Commit Tracker: ${isTrackingActive ? 'Active' : 'Inactive'}`;
    };

    // Set initial states
    await context.workspaceState.update('syncStatus', 'Not synced yet.');
    updateStatusBar();

    context.subscriptions.push(disposableShowDetails);
    context.subscriptions.push(disposableToggleTracking);
    context.subscriptions.push(statusBarItem);
}

function deactivate() {
    trackingManager = null;
}

module.exports = {
    activate,
    deactivate
}