const { Octokit } = require('@octokit/rest');

async function authenticate(token) {
    if (!token) {
        throw new Error('GitHub token is required.');
    }

    const octokit = new Octokit({
        auth: token
    });

    // Verify authentication
    const { data } = await octokit.users.getAuthenticated();
    return {
        octokit,
        login: data.login
    };
}

module.exports = {
    authenticate
};