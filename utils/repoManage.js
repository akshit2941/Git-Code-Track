const vscode = require('vscode');
const { Octokit } = require('@octokit/rest');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * Initializes the repository manager.
 * @param {Object} context - The extension context.
 */
function repositoryManager(context) {
    const gitExtension = vscode.extensions.getExtension('vscode.git');

    if (!gitExtension) {
        vscode.window.showErrorMessage('Git extension not found.');
        return;
    }

    Promise.resolve(gitExtension.activate()).then(() => {
        const git = gitExtension.exports.getAPI(1);

        if (!git) {
            vscode.window.showErrorMessage('Failed to get Git API.');
            return;
        }

        // Initialize Octokit with a Personal Access Token
        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN // Ensure this environment variable is set
        });

        const owner = 'akshit2941'; // Replace with your GitHub username
        const repo = 'git-track';
        const filePath = 'commit-details.md'; // File to update in git-track repository

        let previousCommits = {};

        /**
         * Handles repository state changes.
         * @param {Object} repo - The repository object.
         */
        const handleRepoChange = async (repo) => {
            const repoPath = repo.rootUri.fsPath;
            const branch = repo.state.HEAD?.name;

            if (!branch) return;

            const currentCommit = repo.state.HEAD.commit;

            // Only process new commit if it differs from the previous one
            if (currentCommit && previousCommits[repoPath] !== currentCommit) {
                const commitDetails = await getCommitDetails(repoPath, currentCommit);
                if (commitDetails) {
                    await updateGitHubRepo(commitDetails);
                    previousCommits[repoPath] = currentCommit; // Update the cache
                }
            }
        };

        /**
         * Retrieves commit details using local Git commands.
         * @param {string} repoPath - The repository path.
         * @param {string} commitHash - The commit hash.
         * @returns {Promise<Object|null>} - The commit details or null if not found.
         */
        const getCommitDetails = async (repoPath, commitHash) => {
            try {
                const format = '%H%n%an%n%ae%n%s%n%ad';
                const stdout = await execPromise(`git show -s --format=${format} ${commitHash}`, { cwd: repoPath });
                const [hash, authorName, authorEmail, message, date] = stdout.stdout.split('\n');

                return { hash, authorName, authorEmail, message, date };
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to retrieve commit details: ${error.message}`);
                return null;
            }
        };

        /**
         * Updates the git-track repository on GitHub with commit details.
         * @param {Object} commitDetails - The commit details.
         */
        const updateGitHubRepo = async (commitDetails) => {
            try {
                let existingContent = '';
                let fileSha = null;

                // Fetch the latest file content and SHA
                try {
                    const { data: fileData } = await octokit.repos.getContent({
                        owner,
                        repo,
                        path: filePath,
                        ref: 'main'
                    });

                    if ('content' in fileData) {
                        existingContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
                    }
                    if (Array.isArray(fileData)) {
                        fileSha = fileData[0].sha;
                    } else {
                        fileSha = fileData.sha;
                    }
                } catch (error) {
                    if (error.status !== 404) throw error;
                    // File does not exist yet, so no sha needed
                }

                const newEntry = `- **${commitDetails.hash}**: ${commitDetails.message} by ${commitDetails.authorName} on ${commitDetails.date}`;
                const updatedContent = existingContent ? `${existingContent}\n${newEntry}` : newEntry;
                const encodedContent = Buffer.from(updatedContent).toString('base64');

                // Update or create the file with new commit details
                try {
                    await octokit.repos.createOrUpdateFileContents({
                        owner,
                        repo,
                        path: filePath,
                        message: `Update commit details for ${commitDetails.hash}`,
                        content: encodedContent,
                        sha: fileSha || undefined,  // Pass sha only if the file exists
                        branch: 'main'
                    });

                    // Only notify GitHub update once
                    vscode.window.showInformationMessage('Commit details updated on GitHub.');
                } catch (error) {
                    if (error.status === 409) {
                        // SHA mismatch; refetch and retry
                        const { data: latestFileData } = await octokit.repos.getContent({
                            owner,
                            repo,
                            path: filePath,
                            ref: 'main'
                        });

                        await octokit.repos.createOrUpdateFileContents({
                            owner,
                            repo,
                            path: filePath,
                            message: `Update commit details for ${commitDetails.hash}`,
                            content: encodedContent,
                            sha: Array.isArray(latestFileData) ? latestFileData[0].sha : latestFileData.sha,
                            branch: 'main'
                        });

                        vscode.window.showInformationMessage('Commit details updated after resolving conflict.');
                    } else {
                        throw error;
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to update GitHub repository: ${error.message}`);
            }
        };

        // Initialize existing repositories
        git.repositories.forEach(repo => {
            const repoPath = repo.rootUri.fsPath;
            previousCommits[repoPath] = repo.state.HEAD?.commit;

            repo.state.onDidChange(() => handleRepoChange(repo));
        });

        // Listen for new repositories being opened
        git.onDidOpenRepository((repo) => {
            const repoPath = repo.rootUri.fsPath;
            previousCommits[repoPath] = repo.state.HEAD?.commit;

            repo.state.onDidChange(() => handleRepoChange(repo));
        });

        // Listen for repositories being closed
        git.onDidCloseRepository((repo) => {
            const repoPath = repo.rootUri.fsPath;
            delete previousCommits[repoPath];
        });
    }).catch(err => {
        vscode.window.showErrorMessage(`Failed to activate Git extension: ${err.message}`);
    });
}

module.exports = {
    repositoryManager
};
