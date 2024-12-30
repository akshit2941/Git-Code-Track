const vscode = require('vscode');

async function createGitTrackLogRepo(octokit, owner) {
    const repoName = 'git-track';
    try {
        // Check if the repository already exists
        await octokit.repos.get({
            owner,
            repo: repoName
        });
        vscode.window.showInformationMessage(`Repository '${repoName}' already exists.`);
    } catch (error) {
        if (error.status === 404) {
            // Repository does not exist, create it
            await octokit.repos.createForAuthenticatedUser({
                name: repoName,
                private: true,
                description: 'Repository to log all Git commits tracked by Git-Track extension.'
            });
            vscode.window.showInformationMessage(`Repository '${repoName}' created successfully.`);
        } else {
            vscode.window.showErrorMessage(`Error checking repository: ${error.message}`);
        }
    }
}

module.exports = {
    createGitTrackLogRepo
};