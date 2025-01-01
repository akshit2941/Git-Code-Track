const vscode = require('vscode');
const { Octokit } = require('@octokit/rest');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

async function repositoryManager(context) {
    const secretKey = 'githubAuthToken'; // Key for retrieving the stored token
    const gitExtension = vscode.extensions.getExtension('vscode.git');

    if (!gitExtension) {
        vscode.window.showErrorMessage('Git extension not found.');
        return;
    }

    // Ensure `context.secrets` is used to retrieve the token
    const token = await context.secrets.get(secretKey);

    if (!token) {
        vscode.window.showErrorMessage('GitHub token not found. Please authenticate first.');
        return;
    }

    const octokit = new Octokit({ auth: token });

    const repo = 'git-track';
    const filePath = 'commit-details.md';
    const processedCommits = new Map();
    let isFirstRun = true;

    // Fetch the authenticated user's details (author and owner)
    const getAuthenticatedUser = async () => {
        try {
            const { data } = await octokit.users.getAuthenticated();
            return data.login; // Use the username (login) as the author and owner
        } catch (error) {
            console.error('Error fetching authenticated user:', error);
            vscode.window.showErrorMessage(`Failed to fetch authenticated user: ${error.message}`);
            return null;
        }
    };

    const initializeGitAPI = async () => {
        const git = gitExtension.exports.getAPI(1);

        if (!git) {
            vscode.window.showErrorMessage('Failed to get Git API.');
            return;
        }

        git.repositories.forEach((repo) => setupCommitListener(repo));
        git.onDidOpenRepository(setupCommitListener);
    };

    const setupCommitListener = (repo) => {
        const repoPath = repo.rootUri.fsPath;
        console.log('Setting up listener for repo:', repoPath);

        const isCommonRepo = repoPath.toLowerCase().includes('git-track');
        console.log('Is common repo:', isCommonRepo);

        if (!processedCommits.has(repoPath)) {
            processedCommits.set(repoPath, repo.state.HEAD?.commit || null);

            repo.state.onDidChange(() => {
                if (isFirstRun) {
                    isFirstRun = false;
                    return;
                }

                const currentCommit = repo.state.HEAD?.commit;
                const lastProcessedCommit = processedCommits.get(repoPath);

                if (isCommonRepo && currentCommit && currentCommit !== lastProcessedCommit) {
                    vscode.window.showInformationMessage('New commit detected in git-track repository');
                }

                handleRepoChange(repo);
            });
        }
    };

    const handleRepoChange = async (repo) => {
        const repoPath = repo.rootUri.fsPath;
        const branch = repo.state.HEAD?.name;

        if (!branch) return;

        const currentCommit = repo.state.HEAD.commit;
        const lastProcessedCommit = processedCommits.get(repoPath);

        if (currentCommit && currentCommit !== lastProcessedCommit) {
            processedCommits.set(repoPath, currentCommit);

            const commitDetails = await getCommitDetails(repoPath, currentCommit);
            if (commitDetails) {
                await updateGitHubRepo(commitDetails);
            }
        }
    };

    const getCommitDetails = async (repoPath, commitHash) => {
        try {
            const repoName = repoPath.split('\\').pop();

            const format = '%H%n%s%n%aI';
            const { stdout: commitInfo } = await execPromise(
                `git -C "${repoPath}" show -s --format="${format}" ${commitHash}`
            );
            const [hash, message, isoDate] = commitInfo.trim().split('\n');

            const { stdout: filesChanged } = await execPromise(
                `git -C "${repoPath}" diff-tree --no-commit-id --name-only -r ${commitHash}`
            );
            const changedFiles = filesChanged.trim().split('\n').filter(Boolean);

            const { stdout: branchName } = await execPromise(
                `git -C "${repoPath}" rev-parse --abbrev-ref HEAD`
            );

            const date = new Date(isoDate);
            const indianTime = date.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'full',
                timeStyle: 'long',
            });

            // Fetch the authenticated user's login (used as the author name)
            const author = await getAuthenticatedUser();

            return {
                hash,
                repoName,
                branch: branchName.trim(),
                message,
                date: indianTime,
                changedFiles,
                author, // Include the author (GitHub username)
            };
        } catch (error) {
            console.error('Error in getCommitDetails:', error);
            vscode.window.showErrorMessage(`Failed to retrieve commit details: ${error.message}`);
            return null;
        }
    };

    const updateGitHubRepo = async (commitDetails) => {
        try {
            let existingContent = '';
            let fileSha = null;

            // Get the authenticated user's login dynamically
            const owner = await getAuthenticatedUser();

            if (!owner) {
                vscode.window.showErrorMessage('Failed to get the GitHub user (owner).');
                return;
            }

            // Try to get the content of the file from GitHub
            try {
                const { data } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: filePath,
                    ref: 'main',
                });

                // Decode existing content if found
                if (!Array.isArray(data) && 'content' in data) {
                    existingContent = Buffer.from(data.content, 'base64').toString('utf-8');
                    fileSha = data.sha;
                }
            } catch (error) {
                if (error.status === 404) {
                    // Initialize with the header if the file doesn't exist
                    existingContent = '# Commit Details Log\n\nDetailed tracking of all repository commits.\n\n';
                } else {
                    throw error;
                }
            }

            // Prepare new commit entry
            const newEntry = `## ${commitDetails.date}\n` +
                `- **Repository**: ${commitDetails.repoName}\n` +
                `- **Branch**: ${commitDetails.branch}\n` +
                `- **Commit Hash**: ${commitDetails.hash}\n` +
                `- **Message**: ${commitDetails.message}\n` +
                `- **Files Changed**:\n  ${commitDetails.changedFiles.map(file => `- ${file}`).join('\n  ')}\n` +
                `- **Author**: ${commitDetails.author}\n\n`; // Add author to the entry

            // Prepend new commit entry to existing content
            const updatedContent = `${newEntry}${existingContent}`;

            // Update the file content on GitHub
            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: filePath,
                message: `Update commit details for ${commitDetails.hash}`,
                content: Buffer.from(updatedContent).toString('base64'),
                sha: fileSha,
                branch: 'main',
            });
        } catch (error) {
            console.error('Error in updateGitHubRepo:', error);
            vscode.window.showErrorMessage(`Failed to update GitHub repository: ${error.message}`);
        }
    };

    await gitExtension.activate();
    await initializeGitAPI();
}

module.exports = { repositoryManager };
