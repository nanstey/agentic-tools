# Installation

Install through the root installer. Run this from the tools repository root:

```sh
./install.sh --tool chrome-devtools-cli
chrome-devtools status # check if install worked.
```

## Troubleshooting

- **Command not found:** If `chrome-devtools` is not recognized, ensure your global npm `bin` directory is in your system's `PATH`. Restart your terminal or source your shell configuration file (e.g., `.bashrc`, `.zshrc`).
- **Permission errors:** If you encounter `EACCES` or permission errors during installation, avoid using `sudo`. Instead, use a node version manager like `nvm`, or configure npm to use a different global directory.
- **Old version running:** Run `chrome-devtools stop`, then repeat `./install.sh --tool chrome-devtools-cli` from the tools repository root. Check that PATH selects the installed binary.
