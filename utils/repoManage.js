const vscode = require('vscode');
const { Octokit } = require('@octokit/rest');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

async function repositoryManager(context) {
    const gitExtension = vscode.extensions.getExtension('vscode.git');

    if (!gitExtension) {
        vscode.window.showErrorMessage('Git extension not found.');
        return;
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    const owner = 'akshit2941';
    const repo = 'git-track';
    const filePath = 'commit-details.md';
    const processedCommits = new Map();
    let isFirstRun = true;

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

        if (!processedCommits.has(repoPath)) {
            processedCommits.set(repoPath, repo.state.HEAD?.commit || null);

            repo.state.onDidChange(() => {
                if (isFirstRun) {
                    isFirstRun = false;
                    return;
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
                vscode.window.showInformationMessage(`New commit detected: ${commitDetails.hash}`);
                await updateGitHubRepo(commitDetails);
            }
        }
    };

    const getCommitDetails = async (repoPath, commitHash) => {
        try {
            // Get repository name from the path
            const repoName = repoPath.split('\\').pop(); // Changed to Windows path separator

            // Modified format string to ensure proper date capture
            const format = '%H%n%s%n%B%n%aI%n%an%n%ae'; // Changed to ISO 8601 format
            const { stdout: commitInfo } = await execPromise(
                `git show -s --format="${format}" ${commitHash}`,
                { cwd: repoPath }
            );
            const [hash, subject, body, isoDate, authorName, authorEmail] = commitInfo.trim().split('\n');

            // Get changed files
            const { stdout: filesChanged } = await execPromise(
                `git diff-tree --no-commit-id --name-only -r ${commitHash}`,
                { cwd: repoPath }
            );
            const changedFiles = filesChanged.trim().split('\n').filter(Boolean);

            // Get branch name
            const { stdout: branchName } = await execPromise(
                `git rev-parse --abbrev-ref HEAD`,
                { cwd: repoPath }
            );

            // Format date properly
            const date = new Date(isoDate);
            const indianTime = date.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'full',
                timeStyle: 'long'
            });

            return {
                hash,
                repoName,
                branch: branchName.trim(),
                message: subject,
                fullMessage: body,
                date: indianTime,
                authorName,
                authorEmail,
                changedFiles
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

            try {
                const { data } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: filePath,
                    ref: 'main'
                });

                if (!Array.isArray(data) && 'content' in data) {
                    existingContent = Buffer.from(data.content, 'base64').toString('utf-8');
                    fileSha = data.sha;
                }
            } catch (error) {
                if (error.status === 404) {
                    existingContent = '# Commit Details Log\n\nDetailed tracking of all repository commits.\n\n';
                    vscode.window.showInformationMessage('Creating new commit log file...');
                } else {
                    throw error;
                }
            }

            const newEntry = `## Commit Details - ${commitDetails.date}\n` +
                `- **Repository**: ${commitDetails.repoName}\n` +
                `- **Branch**: ${commitDetails.branch}\n` +
                `- **Commit ID**: ${commitDetails.hash}\n` +
                `- **Files Changed**:\n  ${commitDetails.changedFiles.map(file => `- ${file}`).join('\n  ')}\n` +
                `- **Commit Message**: ${commitDetails.message}\n` +
                `- **Author**: ${commitDetails.authorName} <${commitDetails.authorEmail}>\n\n`;


            const updatedContent = existingContent ? `${existingContent}${newEntry}` : newEntry;

            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: filePath,
                message: fileSha ? `Update commit details for ${commitDetails.hash}` : 'Create commit details log file',
                content: Buffer.from(updatedContent).toString('base64'),
                sha: fileSha,
                branch: 'main',
            });

            vscode.window.showInformationMessage(
                fileSha ? 'Commit details updated on GitHub.' : 'Created commit log file and added first commit.'
            );
        } catch (error) {
            console.error('Error details:', error);
            vscode.window.showErrorMessage(`Failed to update GitHub repository: ${error.message}`);
        }
    };

    await gitExtension.activate();
    await initializeGitAPI();
}

module.exports = { repositoryManager };