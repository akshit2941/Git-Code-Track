# Git-Track

A VSCode extension that automatically tracks and logs Git commits across all your workspace repositories, providing a centralized commit history in a dedicated GitHub repository.

## Features

- Automatic commit tracking across multiple repositories
- Detailed commit logging including:
  - Commit hash
  - Commit message
  - Date and time (Indian Standard Time)
  - Changed files
  - Branch information
- Secure GitHub authentication
- Centralized commit history in a dedicated repository
- Real-time commit detection and logging

## Installation

1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Git-Track"
4. Click Install

## Setup & Authentication

1. Generate a GitHub Personal Access Token:

   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate new token (Fine-Grade-Token)
   - Give suitable permission while creating (give all for better workflow)
   - Select scopes: `repo` and `user`
   - Copy the generated token

2. First Launch:

   - The extension will prompt for authentication
   - Choose "Enter Token Manually"
   - Paste your GitHub Personal Access Token
   - A confirmation message will appear when authenticated

3. Common Repository:
   - After successful authentication, a `git-track` repository will be automatically created
   - This repository will store all your commit logs

## Usage

1. Start Tracking:

   - Press `Ctrl+Alt+T` to start commit tracking
   - A notification will confirm tracking is active

2. View Commit History:

   - All commits will be automatically logged to `commit-details.md` in your `git-track` repository
   - Each entry includes:
     ```
     ## Commit Details - [Date & Time]
     - Repository: [Repository Name]
     - Branch: [Branch Name]
     - Commit Hash: [Hash]
     - Message: [Commit Message]
     - Files Changed: [List of Changed Files]
     ```

3. Stop Tracking:
   - Press `Ctrl+Alt+T again to stop tracking
   - A notification will confirm tracking is stopped

## Requirements

- Visual Studio Code v1.60.0 or higher
- Git installed and configured
- GitHub account
- Active internet connection

## Commands & Shortcuts

- `Ctrl+Alt+T`: Toggle commit tracking
- `Ctrl+Shift+P` → "Git Track: Show Status": View tracking status
- `Ctrl+Shift+P` → "Git Track: Show Commit Details": View recent commit information

## Configuration

No additional configuration required. The extension works out of the box after authentication.

## Version History

### v1.0.0 (Latest)

- Initial release
- Core Features:
  - Automatic commit tracking
  - GitHub authentication
  - Centralized commit logging
  - Real-time commit detection
  - IST timezone support

## Sample Output

```markdown
## Commit Details - Monday, March 18, 2024 at 3:30:45 PM India Standard Time

- Repository: my-project
- Branch: main
- Commit Hash: a1b2c3d4
- Message: Update user authentication
- Files Changed:
  - src/auth.js
  - tests/auth.test.js
```

## Known Issues

- OAuth authentication is under development
- Token must have appropriate permissions for private repositories

## Contributing

Found a bug or have a feature request? Please open an issue on the GitHub repository.

## License

This extension is licensed under the MIT License.
