const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * Formats commit details into Markdown.
 * @param {Object} commit - The commit details.
 * @param {string} commit.hash - The commit hash.
 * @param {string} commit.authorName - The author's name.
 * @param {string} commit.authorEmail - The author's email.
 * @param {string} commit.message - The commit message.
 * @param {string} commit.date - The commit date.
 * @returns {string} - Formatted commit details in Markdown.
 */
function formatCommitDetails(commit) {
    return `### Commit: ${commit.hash}\n` +
        `- **Author:** ${commit.authorName} <${commit.authorEmail}>\n` +
        `- **Date:** ${commit.date}\n` +
        `- **Message:** ${commit.message}\n\n`;
}

/**
 * Appends commit details to commit-log.md in the repository root.
 * @param {string} repoPath - The file system path to the repository.
 * @param {Object} commit - The commit details.
 */
function appendToCommitLog(repoPath, commit) {
    const formattedDetails = formatCommitDetails(commit);
    const logFilePath = path.join(repoPath, 'commit-log.md');

    // Ensure commit-log.md exists with a header
    if (!fs.existsSync(logFilePath)) {
        const header = '# Commit Log\n\n';
        fs.writeFileSync(logFilePath, header, 'utf8');
    }

    // Append commit details
    fs.appendFile(logFilePath, formattedDetails, (err) => {
        if (err) {
            vscode.window.showErrorMessage(`Failed to write to commit-log.md: ${err.message}`);
        }
    });
}

/**
 * Handles a new commit event.
 * Retrieves commit details, logs them, and updates tracking information.
 * @param {Object} context - The extension context.
 * @param {string} repoPath - The repository path.
 * @param {string} branch - The branch name.
 * @param {Object} commit - The commit details.
 */
async function handleCommit(context, repoPath, branch, commit) {
    // Show commit notification
    vscode.window.showInformationMessage(`A new commit has been made on branch '${branch}'.`);

    // Append commit details to commit-log.md
    appendToCommitLog(repoPath, commit);

    // Update last commit timestamp
    const timestamp = new Date().toISOString();
    await context.workspaceState.update('lastCommitTimestamp', timestamp);

    // Update local commit hash
    await context.workspaceState.update(`localCommit_${repoPath}_${branch}`, commit.hash);
}

/**
 * Handles a push event.
 * Notifies the user and updates sync status.
 * @param {Object} context - The extension context.
 * @param {string} repoPath - The repository path.
 * @param {string} branch - The branch name.
 * @param {string} remoteCommitHash - The remote commit hash after push.
 */
async function handlePush(context, repoPath, branch, remoteCommitHash) {
    // Show push notification
    vscode.window.showInformationMessage(`Commits have been pushed to remote on branch '${branch}'.`);

    // Update sync status
    const syncStatus = `Synced at ${new Date().toISOString()}`;
    await context.workspaceState.update('syncStatus', syncStatus);

    // Update remote commit hash
    await context.workspaceState.update(`remoteCommit_${repoPath}_${branch}`, remoteCommitHash);
}

module.exports = {
    handleCommit,
    handlePush
};